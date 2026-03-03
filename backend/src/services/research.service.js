const axios = require('axios');

/**
 * Research Service — Real News Fetching
 *
 * Primary:  GNews API (https://gnews.io) — requires GNEWS_API_KEY in .env
 * Fallback: Economic Times RSS feed — no key required
 *
 * Scans real article text + uploaded document text for risk keywords.
 * Zero hardcoded mock data.
 */
class ResearchService {
  constructor() {
    this.gnewsKey = process.env.GNEWS_API_KEY || null;

    // Risk keywords with severity weights
    this.riskKeywords = {
      CRITICAL: [
        'fraud', 'scam', 'ponzi', 'embezzlement', 'money laundering',
        'insolvency', 'bankruptcy', 'liquidation', 'winding up',
        'wilful defaulter', 'nclt', 'ibc proceedings', 'sebi ban', 'rbi penalty',
      ],
      HIGH: [
        'default', 'npa', 'non-performing', 'dues', 'arrears',
        'litigation', 'lawsuit', 'court case', 'arbitration',
        'regulatory action', 'investigation', 'probe',
        'director disqualification', 'criminal proceedings',
      ],
      MEDIUM: [
        'delayed payment', 'overdue', 'pending approval',
        'regulatory notice', 'show cause', 'audit qualification',
        'related party transaction', 'pledge', 'encumbrance',
      ],
      LOW: [
        'dispute', 'disagreement', 'claim', 'complaint',
        'warning', 'caution', 'concern',
      ],
    };

    this.positiveKeywords = [
      'profit', 'growth', 'expansion', 'award', 'recognition',
      'successful', 'strong performance', 'milestone', 'innovation',
      'market leader', 'competitive advantage', 'diversified', 'record revenue',
    ];

    this.negativeKeywords = [
      'loss', 'decline', 'bankruptcy', 'fraud', 'scandal',
      'layoff', 'downsizing', 'closure', 'suspended', 'penalty',
      'poor performance', 'struggling', 'crisis', 'writeoff', 'default',
    ];
  }

  // ─── News Fetching ────────────────────────────────────────────────────────

  /**
   * Fetch articles using GNews API (primary source)
   */
  async fetchFromGNews(companyName) {
    if (!this.gnewsKey) return [];

    try {
      const url = `https://gnews.io/api/v4/search`;
      const response = await axios.get(url, {
        params: {
          q: `"${companyName}"`,
          token: this.gnewsKey,
          lang: 'en',
          country: 'in',
          max: 10,
        },
        timeout: 8000,
      });

      return (response.data.articles || []).map((a) => ({
        title: a.title || '',
        description: a.description || '',
        content: a.content || '',
        source: a.source?.name || 'GNews',
        url: a.url || '',
        publishedAt: a.publishedAt || '',
      }));
    } catch (err) {
      console.warn('[Research] GNews API error:', err.message);
      return [];
    }
  }

  /**
   * Fetch articles from Economic Times RSS (fallback, no key needed)
   * Parses raw XML without xml2js by using simple regex — keeps dependency count low.
   */
  async fetchFromRSS(companyName) {
    const RSS_FEEDS = [
      'https://economictimes.indiatimes.com/rssfeedstopstories.cms',
      'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    ];

    const keyword = companyName.toLowerCase();
    const articles = [];

    for (const feedUrl of RSS_FEEDS) {
      try {
        const response = await axios.get(feedUrl, {
          timeout: 6000,
          headers: { 'User-Agent': 'CreditForge/1.0' },
        });

        const xml = response.data;

        // Extract <item> blocks
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
          const item = match[1];

          const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(item) ||
            /<title>(.*?)<\/title>/.exec(item) || [])[1] || '';
          const desc = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(item) ||
            /<description>(.*?)<\/description>/.exec(item) || [])[1] || '';
          const link = (/<link>(.*?)<\/link>/.exec(item) || [])[1] || '';
          const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(item) || [])[1] || '';

          // Filter to articles that mention the company
          const combined = (title + ' ' + desc).toLowerCase();
          if (combined.includes(keyword)) {
            articles.push({
              title,
              description: desc.replace(/<[^>]+>/g, '').substring(0, 500),
              content: '',
              source: 'Economic Times',
              url: link,
              publishedAt: pubDate,
            });
          }
        }
      } catch (err) {
        console.warn('[Research] RSS feed error:', feedUrl, err.message);
      }
    }

    return articles;
  }

  // ─── Text Analysis ─────────────────────────────────────────────────────────

  /**
   * Build combined text corpus from articles + uploaded document text
   */
  buildCorpus(articles, documents = []) {
    const articleText = articles
      .map((a) => `${a.title} ${a.description} ${a.content}`)
      .join(' ');

    // Include document extracted text for keyword scanning
    const documentText = documents
      .filter((d) => d.extractedData?.extractedText)
      .map((d) => d.extractedData.extractedText)
      .join(' ');

    return `${articleText} ${documentText}`;
  }

  /**
   * Scan text for risk keywords across all severity levels
   */
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

  /**
   * Sentiment analysis from real article text
   */
  analyzeSentiment(text) {
    const lowerText = text.toLowerCase();
    let positive = 0;
    let negative = 0;

    for (const kw of this.positiveKeywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      positive += (lowerText.match(regex) || []).length;
    }
    for (const kw of this.negativeKeywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      negative += (lowerText.match(regex) || []).length;
    }

    const total = positive + negative;
    const score = total === 0 ? 0 : (positive - negative) / total;

    let label = 'NEUTRAL';
    if (score > 0.3) label = 'POSITIVE';
    else if (score < -0.3) label = 'NEGATIVE';

    return { score: parseFloat(score.toFixed(2)), label, positiveCount: positive, negativeCount: negative };
  }

  /**
   * Classify articles into risk categories based on keyword presence in title+description
   */
  classifyArticles(articles) {
    const litigationTerms = ['litigation', 'lawsuit', 'court', 'nclt', 'ibc', 'arbitration', 'criminal', 'arrested'];
    const regulatoryTerms = ['sebi', 'rbi', 'penalty', 'notice', 'compliance', 'violation', 'regulatory', 'gst notice', 'income tax'];
    const directorTerms = ['director', 'promoter', 'ceo', 'md ', 'chairman', 'disqualified', 'fraud'];
    const negativeNewsTerms = ['loss', 'decline', 'bankruptcy', 'default', 'fraud', 'scam', 'shutdown', 'suspended', 'crisis', 'investigation'];

    const litigation = [];
    const regulatory = [];
    const directorIssues = [];
    const negativeNews = [];

    for (const article of articles) {
      const text = `${article.title} ${article.description}`.toLowerCase();

      if (litigationTerms.some((t) => text.includes(t))) {
        litigation.push({
          type: 'Legal/Litigation',
          headline: article.title,
          source: article.source,
          url: article.url,
          date: article.publishedAt,
          status: 'Reported',
          description: article.description.substring(0, 200),
        });
      }

      if (regulatoryTerms.some((t) => text.includes(t))) {
        regulatory.push({
          authority: 'Regulatory Body',
          type: 'Notice/Penalty',
          headline: article.title,
          source: article.source,
          url: article.url,
          date: article.publishedAt,
          description: article.description.substring(0, 200),
          status: 'Reported',
        });
      }

      if (directorTerms.some((t) => text.includes(t))) {
        directorIssues.push({
          issue: 'Director/Promoter Concern',
          headline: article.title,
          source: article.source,
          url: article.url,
          date: article.publishedAt,
          severity: 'MEDIUM',
          details: article.description.substring(0, 200),
        });
      }

      if (negativeNewsTerms.some((t) => text.includes(t))) {
        negativeNews.push({
          headline: article.title,
          source: article.source,
          url: article.url,
          date: article.publishedAt,
          sentiment: 'NEGATIVE',
          summary: article.description.substring(0, 200),
        });
      }
    }

    // Deduplicate by headline
    const dedup = (arr) => arr.filter((item, idx, self) =>
      self.findIndex((o) => o.headline === item.headline) === idx
    );

    return {
      litigation: dedup(litigation),
      regulatory: dedup(regulatory),
      directorIssues: dedup(directorIssues),
      negativeNews: dedup(negativeNews),
    };
  }

  /**
   * Identify red flags based on analysis results
   */
  identifyRedFlags(riskAnalysis, sentiment, litigations) {
    const redFlags = [];

    if (riskAnalysis.totalRiskScore > 50) {
      redFlags.push({
        severity: 'CRITICAL',
        flag: 'High risk keyword density',
        description: `${riskAnalysis.keywordCounts.length} risk indicators found in news/documents`,
      });
    }

    if (sentiment.score < -0.5) {
      redFlags.push({
        severity: 'HIGH',
        flag: 'Strongly negative sentiment',
        description: 'Predominantly negative news about the company',
      });
    }

    if (litigations.length > 3) {
      redFlags.push({
        severity: 'HIGH',
        flag: 'Multiple reported legal cases',
        description: `${litigations.length} litigation-related news items found`,
      });
    }

    return redFlags;
  }

  /**
   * Generate executive summary from real data
   */
  generateExecutiveSummary(articles, classified, sentiment, riskAnalysis, companyName) {
    const parts = [];
    const totalArticles = articles.length;

    parts.push(
      `Research conducted on "${companyName}" returned ${totalArticles} relevant news article(s) from public sources.`
    );
    parts.push(
      `Litigation-related coverage: ${classified.litigation.length} article(s). ` +
      `Regulatory concerns: ${classified.regulatory.length} article(s).`
    );
    parts.push(`Overall media sentiment: ${sentiment.label} (score: ${sentiment.score.toFixed(2)}).`);

    if (riskAnalysis.totalRiskScore > 30) {
      parts.push(
        `Significant risk signals detected (risk keyword score: ${riskAnalysis.totalRiskScore}). Recommend enhanced due diligence.`
      );
    } else if (totalArticles === 0) {
      parts.push(`No material negative news found in public sources at the time of analysis.`);
    } else {
      parts.push(`Risk indicators within acceptable range based on available public information.`);
    }

    return parts.join(' ');
  }

  // ─── Main Entry Point ─────────────────────────────────────────────────────

  /**
   * Analyze company using real news and document text
   * @param {string} companyName
   * @param {string} pan
   * @param {Array}  documents - array with .extractedData.extractedText
   */
  async analyzeCompany(companyName, pan, documents = []) {
    // 1. Fetch real news
    let articles = await this.fetchFromGNews(companyName);

    if (articles.length === 0) {
      // Fallback to RSS (searches by company name in article text)
      articles = await this.fetchFromRSS(companyName);
    }

    // 2. Build full text corpus (articles + document text)
    const corpus = this.buildCorpus(articles, documents);

    // 3. Keyword and sentiment analysis on real corpus
    const riskAnalysis = this.analyzeRiskKeywords(corpus);
    const sentiment = this.analyzeSentiment(corpus);

    // 4. Classify articles into risk types
    const classified = this.classifyArticles(articles);

    // 5. Red flags
    const redFlags = this.identifyRedFlags(riskAnalysis, sentiment, classified.litigation);

    // 6. Source list (unique)
    const sources = [...new Set(articles.map((a) => a.source || a.url))].slice(0, 10);

    // 7. Executive summary from real data
    const executiveSummary = this.generateExecutiveSummary(
      articles, classified, sentiment, riskAnalysis, companyName
    );

    return {
      litigationCount: classified.litigation.length,
      litigationDetails: classified.litigation,
      regulatoryIssues: classified.regulatory.length,
      regulatoryDetails: classified.regulatory,
      directorIssues: classified.directorIssues.length,
      directorDetails: classified.directorIssues,
      negativeNews: classified.negativeNews.length,
      newsDetails: classified.negativeNews,
      overallSentiment: sentiment.label,
      sentimentScore: sentiment.score,
      riskKeywords: riskAnalysis.keywordCounts,
      sources,
      executiveSummary,
      redFlags,
    };
  }
}

module.exports = new ResearchService();
