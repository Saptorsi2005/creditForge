const axios = require('axios');
const https = require('https');

/**
 * Research Service — Multi-Source Intelligence Layer
 *
 * Source Priority (per query):
 *  1. Google News RSS       — FREE, unlimited, real-time, no key needed
 *  2. Indian Finance RSS    — FREE, unlimited, real-time, no key needed
 *     (Moneycontrol, Business Standard, Live Mint, Financial Express, Business Line)
 *  3. Currents API          — 600 req/day if CURRENTS_API_KEY is set
 *  4. NewsData.io           — 200 req/day if NEWSDATA_API_KEY is set
 *  5. GNews                 — 100 req/day (legacy, if GNEWS_API_KEY is set)
 *  6. Economic Times RSS    — unlimited, final fallback
 *
 * Queries fired per analyzeCompany() call (all parallel):
 *  Q1 — Company name news
 *  Q2 — Promoter / director news
 *  Q3 — Sector headwind news
 *  Q4 — Litigation-specific news
 *  Q5 — MCA director check via CIN (best-effort)
 */
class ResearchService {
  constructor() {
    this.currentsKey = process.env.CURRENTS_API_KEY || null;
    this.newsdataKey = process.env.NEWSDATA_API_KEY || null;
    this.gnewsKey = process.env.GNEWS_API_KEY || null;

    // ── Risk keyword taxonomy ─────────────────────────────────────────────────
    this.riskKeywords = {
      CRITICAL: [
        'fraud', 'scam', 'ponzi', 'embezzlement', 'money laundering',
        'insolvency', 'bankruptcy', 'liquidation', 'winding up',
        'wilful defaulter', 'nclt', 'ibc proceedings', 'sebi ban', 'rbi penalty',
        'criminal charges', 'chargesheet', 'ed raid', 'cbi investigation', 'sfio',
      ],
      HIGH: [
        'default', 'npa', 'non-performing', 'dues', 'arrears',
        'litigation', 'lawsuit', 'court case', 'arbitration',
        'regulatory action', 'investigation', 'probe',
        'director disqualification', 'criminal proceedings',
        'show cause notice', 'tax evasion', 'gst fraud',
      ],
      MEDIUM: [
        'delayed payment', 'overdue', 'pending approval',
        'regulatory notice', 'show cause', 'audit qualification',
        'related party transaction', 'pledge', 'encumbrance',
        'capacity underutilisation', 'plant shutdown',
      ],
      LOW: [
        'dispute', 'disagreement', 'claim', 'complaint',
        'warning', 'caution', 'concern', 'slowdown',
      ],
    };

    this.positiveKeywords = [
      'profit', 'growth', 'expansion', 'award', 'recognition',
      'successful', 'strong performance', 'milestone', 'innovation',
      'market leader', 'competitive advantage', 'diversified', 'record revenue',
      'export growth', 'new order', 'contract win', 'upgrade', 'outperform',
    ];

    this.negativeKeywords = [
      'loss', 'decline', 'bankruptcy', 'fraud', 'scandal',
      'layoff', 'downsizing', 'closure', 'suspended', 'penalty',
      'poor performance', 'struggling', 'crisis', 'writeoff', 'default',
      'debt trap', 'cash crunch', 'npa', 'wilful defaulter', 'downgrade',
    ];

    // Sector headwind query map — India-specific
    this.sectorHeadwindMap = {
      'NBFC': 'NBFC regulation RBI India 2025',
      'Banking': 'banking sector NPA India 2025',
      'Real Estate': 'real estate regulation RERA India 2025',
      'Textiles': 'textile industry headwind India export',
      'Metals': 'steel iron metal prices India duty',
      'Aviation': 'aviation DGCA regulation India',
      'Construction': 'construction infrastructure India',
      'Technology': 'IT sector slowdown India layoff',
      'Healthcare': 'pharma CDSCO regulation India drug',
      'Retail': 'retail ecommerce FDI regulation India',
      'Manufacturing': 'manufacturing PLI India GST',
      'Services': 'services sector GST regulation India',
      'FMCG': 'FMCG consumer demand India rural',
      'IT Services': 'IT services rupee export India 2025',
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RSS XML PARSER (shared utility)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Parse RSS/Atom XML and return normalised articles array.
   * Handles both CDATA-wrapped and plain text fields.
   */
  _parseRSSXml(xml, sourceName, keyword = '') {
    const articles = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1];

      const title = (
        /<title><!\[CDATA\[(.*?)\]\]><\/title>/s.exec(item) ||
        /<title>(.*?)<\/title>/s.exec(item) || []
      )[1] || '';

      const desc = (
        /<description><!\[CDATA\[(.*?)\]\]><\/description>/s.exec(item) ||
        /<description>(.*?)<\/description>/s.exec(item) || []
      )[1] || '';

      const link = (
        /<link>(.*?)<\/link>/s.exec(item) ||
        /<feedburner:origLink>(.*?)<\/feedburner:origLink>/s.exec(item) || []
      )[1] || '';

      const pubDate = (/<pubDate>(.*?)<\/pubDate>/s.exec(item) || [])[1] || '';

      const cleanTitle = title.replace(/<[^>]+>/g, '').trim();
      const cleanDesc = desc.replace(/<[^>]+>/g, '').trim().substring(0, 500);
      const combined = (cleanTitle + ' ' + cleanDesc).toLowerCase();

      if (!keyword) {
        articles.push({
          title: cleanTitle,
          description: cleanDesc,
          content: cleanDesc,
          source: sourceName,
          url: link.trim(),
          publishedAt: pubDate.trim(),
        });
      } else {
        const firstWord = keyword.split(' ')[0].toLowerCase();
        if (combined.includes(firstWord)) {
          articles.push({
            title: cleanTitle,
            description: cleanDesc,
            content: cleanDesc,
            source: sourceName,
            url: link.trim(),
            publishedAt: pubDate.trim(),
          });
        }
      }
    }
    return articles;
  }

  /**
   * Helper to fetch content using native https to avoid axios-specific 503s
   */
  async _fetchWithHttps(url, userAgent) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/rss+xml, application/xml, text/xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        timeout: 15000,
      };

      https.get(url, options, (res) => {
        if (res.statusCode === 503) {
          return reject(new Error('Request failed with status code 503'));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Request failed with status code ${res.statusCode}`));
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { resolve(data); });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // FREE & UNLIMITED SOURCES (no API key required)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Google News RSS — FREE, UNLIMITED, REAL-TIME, NO API KEY
   * India-specific English language search.
   * URL: https://news.google.com/rss/search?q=QUERY&hl=en-IN&gl=IN&ceid=IN:en
   */
  async fetchFromGoogleNews(query) {
    try {
      const encoded = encodeURIComponent(`${query} India`);
      const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      const xmlData = await this._fetchWithHttps(url, userAgent);
      const articles = this._parseRSSXml(xmlData, 'Google News', '');
      console.log(`[Research] Google News RSS: ${articles.length} articles for "${query}"`);
      return articles.slice(0, 15);
    } catch (err) {
      console.warn('[Research] Google News RSS error:', err.message);
      return [];
    }
  }

  /**
   * Indian Financial News RSS — FREE, UNLIMITED, REAL-TIME, NO API KEY
   * 5 major Indian business publications fetched in parallel.
   * Filters articles containing the search keyword.
   */
  async fetchFromIndianFinanceRSS(query) {
    const FEEDS = [
      { url: 'https://www.moneycontrol.com/rss/latestnews.xml', name: 'Moneycontrol' },
      { url: 'https://www.moneycontrol.com/rss/business.xml', name: 'Moneycontrol Business' },
      { url: 'https://www.moneycontrol.com/rss/economy.xml', name: 'Moneycontrol Economy' },
      { url: 'https://economictimes.indiatimes.com/rssfeedstopstories.cms', name: 'Economic Times' },
      { url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', name: 'ET Markets' },
      { url: 'https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms', name: 'ET Industry' },
      { url: 'https://www.business-standard.com/rss/home_page_top_stories.rss', name: 'Business Standard' },
      { url: 'https://www.livemint.com/rss/news', name: 'Live Mint' },
      { url: 'https://www.financialexpress.com/feed/', name: 'Financial Express' },
      { url: 'https://www.thehindubusinessline.com/feeder/default.rss', name: 'Business Line' },
    ];

    const keyword = query;
    const allArticles = [];
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    await Promise.allSettled(
      FEEDS.map(async ({ url, name }) => {
        try {
          const xmlData = await this._fetchWithHttps(url, userAgent);
          const articles = this._parseRSSXml(xmlData, name, keyword);
          allArticles.push(...articles);
        } catch (_) {
          // Individual feed failure doesn't block others
        }
      })
    );

    console.log(`[Research] Indian Finance RSS: ${allArticles.length} articles for "${query}"`);
    return allArticles.slice(0, 20);
  }

  /**
   * Economic Times RSS — FREE, UNLIMITED, ~1hr delay, NO API KEY
   * Final fallback if everything else fails.
   */
  async fetchFromRSS(query) {
    const RSS_FEEDS = [
      'https://economictimes.indiatimes.com/rssfeedstopstories.cms',
      'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    ];
    const keyword = query.toLowerCase();
    const articles = [];
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    for (const feedUrl of RSS_FEEDS) {
      try {
        const xmlData = await this._fetchWithHttps(feedUrl, userAgent);
        articles.push(...this._parseRSSXml(xmlData, 'Economic Times', keyword));
      } catch (err) {
        console.warn('[Research] ET RSS error:', feedUrl, err.message);
      }
    }
    return articles;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAID API SOURCES (optional — used for extra depth when keys are available)
  // ══════════════════════════════════════════════════════════════════════════════

  async fetchFromCurrents(query) {
    if (!this.currentsKey) return [];
    try {
      const response = await axios.get('https://api.currentsapi.services/v1/search', {
        params: { apiKey: this.currentsKey, keywords: query, language: 'en', country: 'IN', limit: 10 },
        timeout: 8000,
      });
      return (response.data.news || []).map((a) => ({
        title: a.title || '', description: a.description || '', content: a.description || '',
        source: a.author || 'Currents', url: a.url || '', publishedAt: a.published || '',
      }));
    } catch (err) {
      console.warn('[Research] Currents API error:', err.message);
      return [];
    }
  }

  async fetchFromNewsData(query) {
    if (!this.newsdataKey) return [];
    try {
      const response = await axios.get('https://newsdata.io/api/1/news', {
        params: { apikey: this.newsdataKey, q: query, language: 'en', country: 'in', size: 10 },
        timeout: 8000,
      });
      return (response.data.results || []).map((a) => ({
        title: a.title || '', description: a.description || '', content: a.content || a.description || '',
        source: a.source_id || 'NewsData', url: a.link || '', publishedAt: a.pubDate || '',
      }));
    } catch (err) {
      console.warn('[Research] NewsData.io error:', err.message);
      return [];
    }
  }

  async fetchFromGNews(query) {
    if (!this.gnewsKey) return [];
    try {
      const response = await axios.get('https://gnews.io/api/v4/search', {
        params: { q: `"${query}"`, token: this.gnewsKey, lang: 'en', country: 'in', max: 10 },
        timeout: 8000,
      });
      return (response.data.articles || []).map((a) => ({
        title: a.title || '', description: a.description || '', content: a.content || '',
        source: a.source?.name || 'GNews', url: a.url || '', publishedAt: a.publishedAt || '',
      }));
    } catch (err) {
      console.warn('[Research] GNews API error:', err.message);
      return [];
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MASTER FETCH ORCHESTRATOR
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Fetch news from all sources with priority:
   *  1. Google News RSS (free, unlimited)
   *  2. Indian Finance RSS (free, unlimited) — fired in parallel with #1
   *  3. Paid APIs (Currents, NewsData) — only if above returned < 5 articles
   *  4. GNews / ET RSS — last resort
   * @param {string} query
   * @param {boolean} isFuzzy - whether this is a fallback broader query
   */
  async fetchNews(query, isFuzzy = false) {
    // Always fire both free unlimited sources in parallel
    const [googleArticles, indianArticles] = await Promise.all([
      this.fetchFromGoogleNews(query),
      this.fetchFromIndianFinanceRSS(query),
    ]);

    let articles = [...googleArticles, ...indianArticles];

    // Supplement with paid APIs if we have keys and need more articles
    if (articles.length < 5) {
      const [currents, newsdata] = await Promise.all([
        this.fetchFromCurrents(query),
        this.fetchFromNewsData(query),
      ]);
      articles = [...articles, ...currents, ...newsdata];
    }

    // Legacy fallbacks
    if (articles.length === 0) articles = await this.fetchFromRSS(query);

    // If still 0 and not already fuzzy, try a broader search (e.g., "UrbanInfra Developers" -> "UrbanInfra")
    if (articles.length === 0 && !isFuzzy) {
      const parts = query.split(' ');
      if (parts.length > 1) {
        const broader = parts[0];
        console.log(`[Research] 0 results for "${query}". Retrying fuzzy: "${broader}"`);
        return this.fetchNews(broader, true);
      }
    }

    // Deduplicate by title
    const results = articles.filter((a, idx, self) =>
      self.findIndex((o) => o.title === a.title) === idx
    );

    // Tag the articles with their relevance type
    return results.map(a => ({
      ...a,
      tag: isFuzzy ? 'RELATED' : 'DIRECT'
    }));
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MCA DIRECTOR CHECK (Best-Effort, Non-Blocking)
  // ══════════════════════════════════════════════════════════════════════════════

  async checkMCADirectors(cin) {
    if (!cin) return [];
    const findings = [];
    try {
      const response = await axios.get(
        `https://www.mca.gov.in/mcafoportal/getCompanyDetails.do`,
        { params: { companyID: cin }, timeout: 6000, headers: { 'User-Agent': 'CreditForge/2.0' } }
      );
      const text = JSON.stringify(response.data || '').toLowerCase();
      if (text.includes('disqualif')) {
        findings.push({
          source: 'MCA21', type: 'Director Disqualification', severity: 'HIGH',
          description: 'Potential director disqualification flag found in MCA records for CIN: ' + cin,
        });
      }
      console.log('[Research] MCA check completed for CIN:', cin);
    } catch (err) {
      console.warn('[Research] MCA check skipped (endpoint unreachable):', err.message);
    }
    return findings;
  }

  /**
   * MCA Indebtedness Check (Best-Effort)
   * Specifically looks for "Charges" or "Lien" registered with MCA.
   */
  async checkMCACharges(cin) {
    if (!cin) return [];
    const findings = [];
    try {
      // Note: In a real prod environment, this would call a paid MCA API aggregator like Probe42 or Tofler.
      // For this implementation, we simulate the scraping logic for the "Charges" tab content.
      const url = `https://www.mca.gov.in/mcafoportal/viewIndexCharges.do`;
      const userAgent = 'CreditForge/2.0';

      // Simulate fetch and search for "Charge" rows
      const response = await axios.get(url, { params: { companyID: cin }, timeout: 6000, headers: { 'User-Agent': userAgent } });
      const text = JSON.stringify(response.data || '').toLowerCase();

      if (text.includes('charge holder') || text.includes('amount of charge')) {
        findings.push({
          source: 'MCA Charges Registry',
          type: 'Existing Lien Detected',
          severity: 'MEDIUM',
          description: 'Company has existing charges registered with other financial institutions. Priority status should be verified.',
        });
      }
    } catch (err) {
      console.warn('[Research] MCA Charges check skipped:', err.message);
    }
    return findings;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TEXT ANALYSIS
  // ══════════════════════════════════════════════════════════════════════════════

  buildCorpus(articles, documents = []) {
    const articleText = articles.map((a) => `${a.title} ${a.description} ${a.content}`).join(' ');
    const documentText = documents
      .filter((d) => d.extractedData?.extractedText)
      .map((d) => d.extractedData.extractedText)
      .join(' ');
    return `${articleText} ${documentText}`;
  }

  analyzeRiskKeywords(text) {
    const lowerText = text.toLowerCase();
    const keywordCounts = [];
    let totalRiskScore = 0;
    const severityWeights = { CRITICAL: 10, HIGH: 7, MEDIUM: 4, LOW: 2 };

    for (const [severity, keywords] of Object.entries(this.riskKeywords)) {
      const weight = severityWeights[severity];
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = lowerText.match(regex);
        const count = matches ? matches.length : 0;
        if (count > 0) {
          keywordCounts.push({ keyword, count, severity, impact: count * weight });
          totalRiskScore += count * weight;
        }
      }
    }
    return { keywordCounts, totalRiskScore };
  }

  analyzeSentiment(text) {
    const lowerText = text.toLowerCase();
    let positive = 0;
    let negative = 0;

    for (const kw of this.positiveKeywords) {
      positive += (lowerText.match(new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')) || []).length;
    }
    for (const kw of this.negativeKeywords) {
      negative += (lowerText.match(new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')) || []).length;
    }

    const total = positive + negative;
    const score = total === 0 ? 0 : (positive - negative) / total;
    let label = 'NEUTRAL';
    if (score > 0.3) label = 'POSITIVE';
    else if (score < -0.3) label = 'NEGATIVE';

    return { score: parseFloat(score.toFixed(2)), label, positiveCount: positive, negativeCount: negative };
  }

  classifyArticles(articles) {
    const litigationTerms = ['litigation', 'lawsuit', 'court', 'nclt', 'ibc', 'arbitration', 'criminal', 'arrested', 'chargesheet', 'fir', 'tribunal'];
    const regulatoryTerms = ['sebi', 'rbi', 'penalty', 'notice', 'compliance', 'violation', 'regulatory', 'gst notice', 'income tax', 'enforcement directorate', 'ed ', 'cbi', 'sfio'];
    const directorTerms = ['director', 'promoter', 'ceo', 'md ', 'chairman', 'disqualified', 'fraud', 'founder', 'managing director'];
    const negativeNewsTerms = ['loss', 'decline', 'bankruptcy', 'default', 'fraud', 'scam', 'shutdown', 'suspended', 'crisis', 'investigation', 'raid', 'npa', 'wilful defaulter'];

    const litigation = [], regulatory = [], directorIssues = [], negativeNews = [];

    for (const article of articles) {
      const text = `${article.title} ${article.description}`.toLowerCase();

      if (litigationTerms.some((t) => text.includes(t))) {
        litigation.push({ type: 'Legal/Litigation', headline: article.title, source: article.source, url: article.url, date: article.publishedAt, status: 'Reported', description: article.description.substring(0, 300) });
      }
      if (regulatoryTerms.some((t) => text.includes(t))) {
        regulatory.push({ authority: 'Regulatory Body', type: 'Notice/Penalty', headline: article.title, source: article.source, url: article.url, date: article.publishedAt, description: article.description.substring(0, 300), status: 'Reported' });
      }
      if (directorTerms.some((t) => text.includes(t))) {
        directorIssues.push({ issue: 'Director/Promoter Concern', headline: article.title, source: article.source, url: article.url, date: article.publishedAt, severity: 'MEDIUM', details: article.description.substring(0, 300) });
      }
      if (negativeNewsTerms.some((t) => text.includes(t))) {
        negativeNews.push({ headline: article.title, source: article.source, url: article.url, date: article.publishedAt, sentiment: 'NEGATIVE', summary: article.description.substring(0, 300) });
      }
    }

    const dedup = (arr) => arr.filter((item, idx, self) => self.findIndex((o) => o.headline === item.headline) === idx);
    return { litigation: dedup(litigation), regulatory: dedup(regulatory), directorIssues: dedup(directorIssues), negativeNews: dedup(negativeNews) };
  }

  identifyRedFlags(riskAnalysis, sentiment, litigations, mcaFindings = []) {
    const redFlags = [];
    if (riskAnalysis.totalRiskScore > 50) {
      redFlags.push({ severity: 'CRITICAL', flag: 'High risk keyword density', description: `${riskAnalysis.keywordCounts.length} risk indicators found in news/documents` });
    }
    if (sentiment.score < -0.5) {
      redFlags.push({ severity: 'HIGH', flag: 'Strongly negative sentiment', description: 'Predominantly negative news coverage about the company' });
    }
    if (litigations.length > 3) {
      redFlags.push({ severity: 'HIGH', flag: 'Multiple reported legal cases', description: `${litigations.length} litigation-related news items found` });
    }
    for (const finding of mcaFindings) {
      redFlags.push({ severity: finding.severity, flag: finding.type, description: finding.description });
    }
    return redFlags;
  }

  extractPromoterNames(documents = []) {
    const names = new Set();
    const patterns = [
      // Standard: Label followed by Name (e.g., "Director: John Doe")
      /(?:director|promoter|md|ceo|chairman|managing director)(?:\s+of\s+the\s+company)?\s*[:\-]\s*(?:Mr\.|Ms\.|Mrs\.)?\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})/gi,
      // Narrative: "is Mr. Name" or similar phrasing
      /(?:director|promoter|md|ceo|chairman|managing director)(?:\s+of\s+the\s+company)?\s+(?:is|named|is\s+Mr\.|is\s+Ms\.|is\s+Mrs\.)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})/gi,
      // Generic: Just name after title without colon
      /(?:director|promoter|md|ceo|chairman|managing director)\s+(?:Mr\.|Ms\.|Mrs\.)?\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})/gi
    ];

    for (const doc of documents) {
      const text = doc.extractedData?.extractedText || '';
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let m;
        while ((m = pattern.exec(text)) !== null) {
          const name = m[1].trim();
          // Filter out generic words that might match capitalized pattern
          if (name.length > 4 && !['The ', 'This ', 'From ', 'With '].some(w => name.startsWith(w))) {
            names.add(name);
          }
          if (names.size >= 3) break;
        }
      }
    }
    const finalNames = [...names];
    console.log(`[Research] Extracted promoter names: ${finalNames.length > 0 ? finalNames.join(', ') : 'None'}`);
    return finalNames;
  }

  generateExecutiveSummary(allArticles, classified, sentiment, riskAnalysis, companyName, sector) {
    const parts = [];
    parts.push(`Research on "${companyName}" (Sector: ${sector || 'N/A'}) returned ${allArticles.length} relevant news article(s) from Google News, Indian financial publications (Moneycontrol, Business Standard, Live Mint, Financial Express, Business Line), and other intelligence feeds.`);
    parts.push(`Litigation-related coverage: ${classified.litigation.length} item(s). Regulatory concerns: ${classified.regulatory.length} item(s). Director/promoter concerns: ${classified.directorIssues.length} item(s).`);
    parts.push(`Overall media sentiment: ${sentiment.label} (score: ${sentiment.score.toFixed(2)}).`);
    if (riskAnalysis.totalRiskScore > 30) {
      parts.push(`Significant risk signals detected (keyword risk score: ${riskAnalysis.totalRiskScore}). Enhanced due diligence recommended.`);
    } else if (allArticles.length === 0) {
      parts.push(`No material negative news found in public sources at the time of analysis.`);
    } else {
      parts.push(`Risk indicators within acceptable range based on available public information.`);
    }
    return parts.join(' ');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Analyse company using multi-source intelligence.
   * @param {string} companyName
   * @param {string} pan
   * @param {string|null} cin         — CIN for MCA lookup
   * @param {string|null} sector      — Sector for headwind query
   * @param {Array}  documents        — Uploaded docs with extractedData.extractedText
   */
  async analyzeCompany(companyName, pan, cin = null, sector = null, documents = []) {
    console.log(`[Research] Starting multi-source analysis for: "${companyName}" | CIN: ${cin || 'N/A'} | Sector: ${sector || 'N/A'}`);

    const promoterNames = this.extractPromoterNames(documents);
    const sectorQuery = sector ? (this.sectorHeadwindMap[sector] || `${sector} India sector 2025`) : null;

    // Fire all queries in parallel
    const [companyArticles, promoterArticles, sectorArticles, litigationArticles, mcaFindings, mcaCharges] =
      await Promise.all([
        this.fetchNews(companyName),
        promoterNames.length > 0 ? this.fetchNews(`${promoterNames[0]} ${companyName}`) : Promise.resolve([]),
        sectorQuery ? this.fetchNews(sectorQuery).then(results => results.map(a => ({ ...a, tag: 'INDUSTRY' }))) : Promise.resolve([]),
        this.fetchNews(`"${companyName}" court case lawsuit NCLT`),
        this.checkMCADirectors(cin),
        this.checkMCACharges(cin),
      ]);

    console.log(`[Research] Results — Company: ${companyArticles.length}, Promoter: ${promoterArticles.length}, Sector: ${sectorArticles.length}, Litigation: ${litigationArticles.length}, MCA Findings: ${mcaFindings.length + mcaCharges.length}`);

    // Merge company + promoter + litigation articles (deduplicated)
    const allArticles = [...companyArticles, ...promoterArticles, ...litigationArticles]
      .filter((a, idx, self) => self.findIndex((o) => o.title === a.title) === idx);

    // Text analysis
    const corpus = this.buildCorpus(allArticles, documents);
    const riskAnalysis = this.analyzeRiskKeywords(corpus);
    const sentiment = this.analyzeSentiment(corpus);
    const classified = this.classifyArticles(allArticles);

    // Combine all external intelligence findings
    const combinedFindings = [...mcaFindings, ...mcaCharges];
    const redFlags = this.identifyRedFlags(riskAnalysis, sentiment, classified.litigation, combinedFindings);

    const sourceSet = new Set([
      ...allArticles.map((a) => a.source || a.url),
      ...(combinedFindings.length > 0 ? ['MCA21 Public Registry'] : []),
    ]);
    const sources = [...sourceSet].slice(0, 15);

    const executiveSummary = this.generateExecutiveSummary(allArticles, classified, sentiment, riskAnalysis, companyName, sector);

    const sectorContext = sectorArticles.length > 0
      ? ` Sector Intelligence (${sector}): ${sectorArticles.length} macro articles — ${sectorArticles.slice(0, 2).map((a) => a.title).join('; ')}`
      : '';

    return {
      litigationCount: classified.litigation.length,
      litigationDetails: classified.litigation,
      regulatoryIssues: classified.regulatory.length,
      regulatoryDetails: classified.regulatory,
      directorIssues: classified.directorIssues.length,
      directorDetails: classified.directorIssues,
      allArticles,
      sentimentScore: sentiment.score,
      overallSentiment: sentiment.label,
      riskKeywords: riskAnalysis.keywordCounts,
      riskScore: riskAnalysis.totalRiskScore,
      sources,
      executiveSummary: executiveSummary + sectorContext,
      redFlags,
      serviceNote: allArticles.length === 0 ? "No material negative news discovered in current top business feeds. For historical deep-search of private entities, please configure a News API key." : null,
    };
  }
}

module.exports = new ResearchService();
