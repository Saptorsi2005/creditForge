'use strict';

const pdf = require('pdf-parse');
const fs = require('fs').promises;
// Modern pdfjs-dist supports PDF 1.5+ compressed XRef streams (pdf-parse bundles old v1.10.100)
let pdfjsLib = null;
try {
  pdfjsLib = require('pdfjs-dist/build/pdf');
  // Disable the worker in Node.js (not needed for text extraction)
  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
} catch (e) {
  console.warn('[PDFService] pdfjs-dist not available — Strategy 4 disabled:', e.message);
}

/**
 * PDF Extraction Engine — Production Grade
 *
 * Design decisions:
 *  - All text is collapsed to single-space before matching (handles PDF whitespace chaos)
 *  - Numbers are matched as: optional currency prefix + digits/commas/dots + optional unit suffix
 *  - Values in Crore are converted to raw rupees (×10_000_000) for consistent DB storage
 *  - Multi-year extraction finds ANY year block dynamically (not hardcoded FY22/23/24)
 *  - If extraction produces 0 for a mandatory field it stays 0; NULL means truly not found
 */
class PDFService {
  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Normalise raw PDF text:
   * 1. Replace all whitespace sequences with a single space
   * 2. Trim
   */
  _normalize(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Parse a raw string like "38.5", "1,234.56", "38,50,000" into a JS number.
   * Returns null if not parseable.
   */
  _parseNumber(raw) {
    if (raw === null || raw === undefined) return null;
    const cleaned = String(raw).replace(/,/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  /**
   * Determine the unit multiplier based on unit string found in text.
   * Crore / Cr           → 10,000,000
   * Lakh / Lac           → 100,000
   * Million              → 1,000,000
   * Thousand / K         → 1,000
   * (none / plain rupee) → 1
   */
  _unitMultiplier(unitStr = '') {
    const u = unitStr.toLowerCase().trim();
    if (/crore|crores|cr\b/.test(u)) return 10_000_000;
    if (/lakh|lac|lakhs/.test(u)) return 100_000;
    if (/million/.test(u)) return 1_000_000;
    if (/thousand|^\s*k\s*$/.test(u)) return 1_000;
    return 1; // assume rupees / absolute number
  }

  /**
   * Build a regex that finds a financial keyword followed (within ~120 chars) by a number+unit.
   *
   * Keyword examples: 'revenue', 'net profit', 'ebitda'
   * Allows between keyword and number: optional separator chars (-, :, ₹, Rs., INR, spaces)
   */
  _buildKeywordPattern(keyword) {
    // Escape special regex chars in multi-word keywords
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s\\-:]*');
    return new RegExp(
      `(?:${escaped})[^\\d]{0,80}?` +               // keyword, then up to 80 non-digit chars gap
      `(?:rs\\.?|inr|₹)?[\\s]*` +                   // optional currency prefix
      `([0-9][0-9,]*(?:\\.[0-9]+)?)` +              // THE NUMBER (captured)
      `\\s*` +
      `(crores?|crore|cr\\b|lakhs?|lac|million|thousand|k)?`, // optional unit
      'gi'
    );
  }

  /**
   * Run a keyword-based extraction on normalised text.
   * Returns value in RUPEES, or null.
   */
  _extractValue(text, keywords) {
    for (const kw of keywords) {
      const pattern = this._buildKeywordPattern(kw);
      pattern.lastIndex = 0;

      // Try all matches; take the first plausible one
      let m;
      while ((m = pattern.exec(text)) !== null) {
        const num = this._parseNumber(m[1]);
        if (num === null || num <= 0) continue;

        const unit = m[2] || '';
        const mult = this._unitMultiplier(unit);
        return parseFloat((num * mult).toFixed(2));
      }
      pattern.lastIndex = 0;
    }
    return null;
  }

  // ── Multi-Year Revenue Extraction ─────────────────────────────────────────

  /**
   * Dynamically find year blocks of the form:
   *   FY22 / FY-22 / FY 22 / FY2022 / Financial Year 2022 / 2021-22 / 2022-23
   *
   * For each block, find the nearest revenue / sales / turnover figure.
   *
   * Returns an array sorted ascending by year:
   *   [{ year: 2022, revenue: 385000000, ebitda: 62000000 }, ...]
   */
  _extractMultiYearData(text) {
    // Pattern to locate a year reference anywhere in the text
    // Captures the 4-digit calendar year that the FY refers to
    // FY22 → 2022, FY2023 → 2023, 2022-23 → 2023, Financial Year 2023 → 2023
    const yearRefs = [];

    const YR_PATTERN = new RegExp(
      // Case 1: FY22, FY-23, FY 24, FY2022, FY2023
      `(?:fy[\\-\\s]?(\\d{2,4}))` +
      `|` +
      // Case 2: 2021-22, 2022-23 (Indian FY range — take the ending year)
      `(?:(\\d{4})[\\-–](\\d{2,4}))` +
      `|` +
      // Case 3: Financial Year 2022, Year 2022
      `(?:(?:financial\\s+year|year)[\\s:]*([12]\\d{3}))`,
      'gi'
    );

    let yrMatch;
    while ((yrMatch = YR_PATTERN.exec(text)) !== null) {
      let year = null;

      if (yrMatch[1]) {
        // FY22 / FY2022 style
        const raw = yrMatch[1];
        year = raw.length === 2 ? 2000 + parseInt(raw, 10) : parseInt(raw, 10);
      } else if (yrMatch[2] && yrMatch[3]) {
        // 2021-22 style → ending year
        const end = yrMatch[3];
        const start = parseInt(yrMatch[2], 10);
        year = end.length === 2 ? start + 1 : parseInt(end, 10);
      } else if (yrMatch[4]) {
        year = parseInt(yrMatch[4], 10);
      }

      if (year && year >= 2018 && year <= 2030) {
        yearRefs.push({ year, pos: yrMatch.index });
      }
    }

    if (yearRefs.length === 0) return [];

    // Deduplicate by year (keep earliest position for each)
    const deduped = [];
    const seen = new Set();
    for (const ref of yearRefs) {
      if (!seen.has(ref.year)) {
        seen.add(ref.year);
        deduped.push(ref);
      }
    }

    // For each year ref, extract revenue + ebitda from the text WINDOW around it
    const WINDOW = 300; // chars to look ahead from the year marker

    const results = deduped.map(({ year, pos }) => {
      const window = text.substring(pos, pos + WINDOW);

      const rev = this._extractValue(window, [
        'revenue', 'total revenue', 'net revenue',
        'sales', 'net sales', 'total sales',
        'turnover', 'total turnover', 'net turnover',
      ]);

      const ebitda = this._extractValue(window, [
        'ebitda', 'operating profit', 'ebita',
      ]);

      return { year, revenue: rev, ebitda };
    }).filter((r) => r.revenue !== null || r.ebitda !== null);

    return results.sort((a, b) => a.year - b.year);
  }

  // ── Primary Financial Extraction ──────────────────────────────────────────

  /**
   * Extract all key financial metrics from normalised text.
   * Falls back to global search if no multi-year block found.
   */
  parseFinancialData(rawText) {
    const text = this._normalize(rawText);

    // ── Step 1: Multi-year revenue/EBITDA data ─────────────────────────────
    const multiYearArray = this._extractMultiYearData(text);

    // ── Step 2: Latest year values (or global fallback) ────────────────────
    let revenue = null;
    let ebitda = null;
    let multiYearRevenue = null;

    if (multiYearArray.length >= 1) {
      multiYearRevenue = multiYearArray; // full array stored as JSON
      // Use the latest year's values as primary
      const latest = multiYearArray[multiYearArray.length - 1];
      revenue = latest.revenue;
      ebitda = latest.ebitda;
    }

    // Global fallback — search entire doc without year context
    if (revenue === null) {
      revenue = this._extractValue(text, [
        'total revenue', 'net revenue', 'revenue from operations',
        'revenue', 'net sales', 'total sales', 'sales',
        'total turnover', 'turnover',
      ]);
    }
    if (ebitda === null) {
      ebitda = this._extractValue(text, [
        'ebitda', 'operating profit', 'profit before depreciation interest and tax',
        'pbdit', 'ebita',
      ]);
    }

    // ── Step 3: Other financial fields ────────────────────────────────────
    const netProfit = this._extractValue(text, [
      'profit after tax', 'net profit after tax', 'net profit',
      'pat', 'profit for the year', 'profit for the period',
    ]);

    const totalDebt = this._extractValue(text, [
      'total borrowings', 'total debt', 'borrowings',
      'long term borrowings', 'secured loans',
    ]);

    const netWorth = this._extractValue(text, [
      "shareholders' equity", 'shareholders equity',
      'net worth', 'total equity', 'equity share capital',
      'total stockholders equity',
    ]);

    const totalAssets = this._extractValue(text, [
      'total assets',
    ]);

    const currentAssets = this._extractValue(text, [
      'total current assets', 'current assets',
    ]);

    const currentLiabilities = this._extractValue(text, [
      'total current liabilities', 'current liabilities',
    ]);

    // ── Step 4: Revenue growth ────────────────────────────────────────────
    let revenueGrowth = null;
    if (multiYearArray.length >= 2) {
      const prev = multiYearArray[multiYearArray.length - 2];
      const latest = multiYearArray[multiYearArray.length - 1];
      if (prev.revenue && latest.revenue && prev.revenue !== 0) {
        revenueGrowth = parseFloat(
          (((latest.revenue - prev.revenue) / prev.revenue) * 100).toFixed(2)
        );
      }
    }

    // ── Step 5: Derived metrics ───────────────────────────────────────────
    let ebitdaMargin = null;
    let netProfitMargin = null;
    let debtToEquity = null;
    let currentRatio = null;

    if (revenue && revenue !== 0) {
      if (ebitda !== null) ebitdaMargin = parseFloat(((ebitda / revenue) * 100).toFixed(2));
      if (netProfit !== null) netProfitMargin = parseFloat(((netProfit / revenue) * 100).toFixed(2));
    }
    if (totalDebt !== null && netWorth && netWorth !== 0) {
      debtToEquity = parseFloat((totalDebt / netWorth).toFixed(2));
    }
    if (currentAssets !== null && currentLiabilities && currentLiabilities !== 0) {
      currentRatio = parseFloat((currentAssets / currentLiabilities).toFixed(2));
    }

    const result = {
      revenue,
      revenueGrowth,
      ebitda,
      ebitdaMargin,
      netProfit,
      netProfitMargin,
      totalDebt,
      netWorth,
      totalAssets,
      currentAssets,
      currentLiabilities,
      debtToEquity,
      currentRatio,
      multiYearRevenue,   // array or null
    };

    // ── Debug log (safe to remove once stable) ────────────────────────────
    console.log('[PDFService] Extracted financials:', JSON.stringify({
      revenue,
      revenueGrowth,
      ebitda,
      ebitdaMargin,
      netProfit,
      totalDebt,
      netWorth,
      debtToEquity,
      multiYearYears: multiYearArray.map((r) => r.year),
    }, null, 2));

    return result;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Extract text from a PDF file.
   * Tries multiple strategies to handle corrupted / compressed-XRef (PDF 1.5+) files.
   * Never throws — returns empty string on total failure so the pipeline can continue.
   */
  async extractText(filePath) {
    let dataBuffer;
    try {
      dataBuffer = await fs.readFile(filePath);
    } catch (readErr) {
      console.error('[PDFService] Cannot read file:', readErr.message);
      return '';
    }

    // ── Strategy 1: Standard parse ────────────────────────────────────────
    try {
      const data = await pdf(dataBuffer);
      if (data.text && data.text.trim().length > 0) {
        console.log('[PDFService] Strategy 1 (standard) succeeded, text length:', data.text.length);
        return data.text;
      }
    } catch (e1) {
      console.warn('[PDFService] Strategy 1 failed:', e1.message);
    }

    // ── Strategy 2: Page-by-page render (tolerates per-page errors) ───────
    try {
      let fullText = '';
      const opts = {
        pagerender: async (pageData) => {
          try {
            const textContent = await pageData.getTextContent();
            return textContent.items.map((item) => item.str).join(' ');
          } catch (_) {
            return ''; // skip bad pages silently
          }
        },
      };
      const data = await pdf(dataBuffer, opts);
      fullText = data.text || '';
      if (fullText.trim().length > 0) {
        console.log('[PDFService] Strategy 2 (page-render) succeeded, text length:', fullText.length);
        return fullText;
      }
    } catch (e2) {
      console.warn('[PDFService] Strategy 2 failed:', e2.message);
    }

    // ── Strategy 3: Raw buffer parse with max:0 option ────────────────────
    try {
      const data = await pdf(dataBuffer, { max: 0 });
      if (data.text && data.text.trim().length > 0) {
        console.log('[PDFService] Strategy 3 (max:0) succeeded, text length:', data.text.length);
        return data.text;
      }
    } catch (e3) {
      console.warn('[PDFService] Strategy 3 failed:', e3.message);
    }

    // ── Strategy 4: Modern pdfjs-dist (handles compressed XRef, PDF 1.5+) ──
    if (pdfjsLib) {
      try {
        const uint8Array = new Uint8Array(dataBuffer);
        const loadingTask = pdfjsLib.getDocument({
          data: uint8Array,
          // Suppress pdfjs verbose warnings
          verbosity: 0,
        });
        const pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;
        const textParts = [];

        for (let i = 1; i <= numPages; i++) {
          try {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(' ');
            textParts.push(pageText);
          } catch (pageErr) {
            console.warn(`[PDFService] Strategy 4: page ${i} error:`, pageErr.message);
          }
        }

        const combined = textParts.join('\n');
        if (combined.trim().length > 0) {
          console.log('[PDFService] Strategy 4 (pdfjs-dist) succeeded, text length:', combined.length);
          return combined;
        }
      } catch (e4) {
        console.warn('[PDFService] Strategy 4 failed:', e4.message);
      }
    }

    console.error('[PDFService] All extraction strategies failed for:', filePath,
      '— This PDF may be image-based (scanned) or severely corrupted. Financial fields will be NULL.');
    return ''; // Return empty string — pipeline continues, financials will be null
  }

  /**
   * Primary entry point for financial PDFs.
   * Returns { extractedText, financialData, extractedAt }
   */
  async processDocument(filePath) {
    const text = await this.extractText(filePath);
    const financialData = this.parseFinancialData(text);

    return {
      extractedText: text.substring(0, 10000), // store up to 10k chars for risk keyword scanning
      financialData,
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Parse a pattern map against normalised text (used for GST / bank docs)
   */
  _parsePatternMap(rawText, patternMap) {
    const text = this._normalize(rawText);
    const data = {};
    for (const [key, pattern] of Object.entries(patternMap)) {
      pattern.lastIndex = 0;
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const num = this._parseNumber(matches[0][1]);
        if (num !== null) data[key] = num;
      }
    }
    return data;
  }

  /**
   * Extract GST revenue from GST returns
   */
  async parseGSTDocument(filePath) {
    const text = await this.extractText(filePath);
    const gstPatterns = {
      totalTurnover: /(?:total\s+turnover|taxable\s+turnover)[\s:]*(?:rs\.?|inr|₹)?[\s]*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,
      taxLiability: /(?:tax\s+liability|total\s+tax)[\s:]*(?:rs\.?|inr|₹)?[\s]*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,
    };
    return this._parsePatternMap(text, gstPatterns);
  }

  /**
   * Extract bank statement data
   */
  async parseBankDocument(filePath) {
    const text = await this.extractText(filePath);
    const bankPatterns = {
      totalCredits: /(?:total\s+credits?|total\s+inward|credit\s+total)[\s:]*(?:rs\.?|inr|₹)?[\s]*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,
      totalDebits: /(?:total\s+debits?|total\s+outward|debit\s+total)[\s:]*(?:rs\.?|inr|₹)?[\s]*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,
      avgBalance: /(?:average\s+balance|avg\s+balance|average\s+monthly\s+balance)[\s:]*(?:rs\.?|inr|₹)?[\s]*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,
    };
    return this._parsePatternMap(text, bankPatterns);
  }
}

module.exports = new PDFService();
