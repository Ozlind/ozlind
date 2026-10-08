/* -------------------------------------------------------------------------- */
/* MESSAGE / SEARCH HELPERS                                                   */
/* -------------------------------------------------------------------------- */

function userText(message) {
  if (typeof message?.content === "string") {
    return message.content;
  }

  if (Array.isArray(message?.content)) {
    return message.content
      .filter((part) => part?.type === "text")
      .map((part) => part.text || "")
      .join(" ");
  }

  return "";
}

export function buildSearchQuery(messages) {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map(userText)
    .map((text) =>
      text
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  const latest =
    userMessages[userMessages.length - 1] || "";

  const previous =
    userMessages[userMessages.length - 2] || "";

  /*
   * Very short follow-ups such as:
   * "what about Kerala?"
   * "and today?"
   * should retain the previous user topic.
   */
  if (latest.length < 80 && previous) {
    return `${previous.slice(0, 350)} ${latest}`.trim();
  }

  return latest;
}

function normalizeQuery(query) {
  return String(query || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function looksLikeNews(query) {
  return /\b(?:news|latest|breaking|headlines|today|tonight|this week|happening|happened|story|stories|report|reports|announcement|announcements|score|won|results?)\b/i.test(
    query,
  );
}

function looksLikeFreshValue(query) {
  return /\b(?:current|latest|today|now|live|real[\s-]?time|present|as of|price|rate|value|weather|forecast|status|schedule|result|version|release|stock|bitcoin|crypto|exchange)\b/i.test(
    query,
  );
}

function isResearchSensitiveQuery(query) {
  return (
    looksLikeNews(query) ||
    looksLikeFreshValue(query)
  );
}

function queryTerms(query) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "can",
    "do",
    "for",
    "from",
    "give",
    "has",
    "have",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "or",
    "please",
    "search",
    "tell",
    "that",
    "the",
    "their",
    "this",
    "to",
    "today",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "with",
    "you",
    "your",
    "web",
    "online",
    "latest",
    "current",
    "news",
    "latest",
    "major",
    "stories",
    "story",
    "according",
    "sources",
    "source",
    "approximate",
  ]);

  return [
    ...new Set(
      String(query || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(
          (term) =>
            term.length >= 3 &&
            !stopWords.has(term),
        ),
    ),
  ].slice(0, 14);
}

function resultText(item) {
  return [
    item?.title,
    item?.content,
    item?.url,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function relevanceScore(item, query) {
  const terms = queryTerms(query);

  if (!terms.length) {
    return 0;
  }

  const title =
    String(item?.title || "").toLowerCase();

  const content =
    String(item?.content || "").toLowerCase();

  const url =
    String(item?.url || "").toLowerCase();

  let score = 0;

  for (const term of terms) {
    const titleMatch = title.includes(term);
    const contentMatch = content.includes(term);
    const urlMatch = url.includes(term);

    if (titleMatch) {
      score += 5;
    } else if (contentMatch) {
      score += 2;
    } else if (urlMatch) {
      score += 1;
    }
  }

  return score;
}

function domainQuality(domain) {
  const value =
    String(domain || "").toLowerCase();

  if (!value) {
    return 0;
  }

  /*
   * Prefer established news, government, institutional,
   * financial and primary-source domains without
   * hard-requiring a fixed allow-list.
   */
  if (
    /\.(gov|gov\.in|edu|ac\.in)$/i.test(value) ||
    value.endsWith(".gov") ||
    value.endsWith(".edu")
  ) {
    return 4;
  }

  if (
    /(^|\.)reuters\.com$|(^|\.)apnews\.com$|(^|\.)bbc\.com$|(^|\.)bbc\.co\.uk$|(^|\.)cnn\.com$|(^|\.)nbcnews\.com$|(^|\.)cnbc\.com$|(^|\.)bloomberg\.com$|(^|\.)nytimes\.com$|(^|\.)theguardian\.com$|(^|\.)euronews\.com$|(^|\.)techcrunch\.com$|(^|\.)wired\.com$|(^|\.)arstechnica\.com$|(^|\.)nature\.com$|(^|\.)science\.org$|(^|\.)microsoft\.com$|(^|\.)googleblog\.com$|(^|\.)blog\.google$|(^|\.)apple\.com$|(^|\.)amazon\.com$|(^|\.)openai\.com$|(^|\.)anthropic\.com$/i.test(
      value,
    )
  ) {
    return 3;
  }

  /*
   * Penalize obvious low-quality aggregation/scraping
   * patterns. They are not automatically rejected.
   */
  if (
    /pinterest|facebook|reddit|quora|medium|blogspot|wordpress|cleverhack|lottery|coupon/i.test(
      value,
    )
  ) {
    return -3;
  }

  return 0;
}

function parsePublishedDate(item) {
  const raw =
    item?.published_date ||
    item?.publishedDate ||
    item?.date ||
    "";

  if (!raw) {
    return null;
  }

  const timestamp =
    Date.parse(String(raw));

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
}

function daysSince(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const age =
    Date.now() - timestamp;

  return age / 86400000;
}

function freshnessScore(
  item,
  query,
) {
  const timestamp =
    parsePublishedDate(item);

  if (timestamp === null) {
    /*
     * Tavily may return useful live pages without
     * a publication date. Do not automatically discard them.
     */
    return 0;
  }

  const age =
    daysSince(timestamp);

  if (age === null) {
    return 0;
  }

  if (age < 0) {
    return 1;
  }

  if (looksLikeNews(query)) {
    if (age <= 2) return 5;
    if (age <= 7) return 3;
    if (age <= 14) return 1;
    return -5;
  }

  if (looksLikeFreshValue(query)) {
    if (age <= 1) return 5;
    if (age <= 3) return 3;
    if (age <= 7) return 1;
    return -5;
  }

  return age <= 30 ? 1 : 0;
}

function scoreResult(item, query) {
  return (
    relevanceScore(item, query) +
    domainQuality(item?.domain) +
    freshnessScore(item, query)
  );
}

function hasStrongRelevance(item, query) {
  const relevance =
    relevanceScore(item, query);

  /*
   * For a topical/current query, at least one
   * meaningful query term must appear in the result.
   *
   * This prevents unrelated results such as lottery,
   * weather or generic Kerala stories from being
   * presented for an AI-news query.
   */
  if (queryTerms(query).length === 0) {
    return true;
  }

  return relevance >= 2;
}

function uniqueSources(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const seenDomains = new Set();
  const output = [];

  for (const item of items) {
    const url =
      String(item?.url || "").trim();

    const title =
      String(item?.title || "")
        .trim()
        .toLowerCase();

    const domain =
      String(item?.domain || "")
        .trim()
        .toLowerCase();

    if (!url) {
      continue;
    }

    if (seenUrls.has(url)) {
      continue;
    }

    if (title && seenTitles.has(title)) {
      continue;
    }

    /*
     * Do not let one low-quality domain occupy
     * the complete source list.
     */
    if (
      domain &&
      seenDomains.has(domain) &&
      output.length >= 3
    ) {
      continue;
    }

    seenUrls.add(url);

    if (title) {
      seenTitles.add(title);
    }

    if (domain) {
      seenDomains.add(domain);
    }

    output.push(item);

    if (output.length >= 6) {
      break;
    }
  }

  return output;
}

function publicSources(sources) {
  return sources.map(
    ({
      title,
      url,
      domain,
      publishedDate,
    }) => ({
      title,
      url,
      domain,
      ...(publishedDate
        ? { publishedDate }
        : {}),
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* WEB RESEARCH                                                               */
/* -------------------------------------------------------------------------- */

export async function performResearch(
  query,
  signal,
) {
  const apiKey =
    process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return {
      sources: [],
      notice: null,
    };
  }

  const normalized =
    normalizeQuery(query);

  if (!normalized) {
    return {
      sources: [],
      notice: null,
    };
  }

  const news =
    looksLikeNews(normalized);

  const freshnessSensitive =
    isResearchSensitiveQuery(
      normalized,
    );

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      12000,
    );

  const abortParent =
    () =>
      controller.abort();

  signal?.addEventListener(
    "abort",
    abortParent,
    {
      once: true,
    },
  );

  try {
    const searchBody = {
      api_key: apiKey,
      query: normalized,

      /*
       * Advanced search gives Tavily more context
       * for relevance-sensitive queries.
       */
      search_depth: "advanced",

      include_answer: false,

      /*
       * Fetch more candidates than we finally expose.
       * The local relevance/freshness layer selects
       * the strongest results.
       */
      max_results: news
        ? 8
        : 7,
    };

    if (news) {
      searchBody.topic = "news";
      searchBody.days = 7;
    }

    const response =
      await fetch(
        "https://api.tavily.com/search",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${apiKey}`,
          },
          body:
            JSON.stringify(
              searchBody,
            ),
          signal:
            controller.signal,
          cache: "no-store",
        },
      );

    if (!response.ok) {
      return {
        sources: [],
        notice:
          "Live web sources were unavailable, so OZLIND continued without them.",
      };
    }

    const data =
      await response.json();

    if (
      !Array.isArray(
        data?.results,
      )
    ) {
      return {
        sources: [],
        notice:
          "No usable live sources were found.",
      };
    }

    const candidates =
      data.results
        .filter(
          (item) =>
            item &&
            typeof item.url ===
              "string" &&
            item.url.trim(),
        )
        .map((item) => {
          let domain = "";

          try {
            domain =
              new URL(
                item.url,
              ).hostname
                .replace(
                  /^www\./i,
                  "",
                );
          } catch {
            domain = "";
          }

          const publishedTimestamp =
            parsePublishedDate(item);

          const publishedDate =
            publishedTimestamp !==
            null
              ? new Date(
                  publishedTimestamp,
                ).toISOString()
              : "";

          return {
            title:
              typeof item.title ===
                "string" &&
              item.title.trim()
                ? item.title.trim()
                : item.url,

            url:
              item.url.trim(),

            domain,

            content:
              typeof item.content ===
                "string"
                ? item.content
                    .trim()
                    .slice(0, 2200)
                : "",

            publishedDate,

            score: scoreResult(
              {
                ...item,
                domain,
              },
              normalized,
            ),
          };
        });

    /*
     * Relevance is mandatory for topical/current
     * queries. This is the main protection against
     * unrelated search results.
     */
    const relevant =
      candidates.filter(
        (item) =>
          hasStrongRelevance(
            item,
            normalized,
          ),
      );

    const ranked =
      relevant
        .sort(
          (a, b) =>
            b.score - a.score,
        );

    const freshRanked =
      freshnessSensitive
        ? ranked.filter((item) => {
            const published =
              parsePublishedDate(
                item,
              );

            if (
              published === null
            ) {
              return true;
            }

            const age =
              daysSince(
                published,
              );

            if (age === null) {
              return true;
            }

            if (news) {
              return age <= 14;
            }

            return age <= 7;
          })
        : ranked;

    const selected =
      uniqueSources(
        (
          freshRanked.length
            ? freshRanked
            : ranked
        ).slice(0, 6),
      );

    if (!selected.length) {
      return {
        sources: [],
        notice:
          freshnessSensitive
            ? "Fresh, relevant web sources could not be verified for this request."
            : "No relevant live web sources were found.",
      };
    }

    const staleOnly =
      freshnessSensitive &&
      freshRanked.length === 0 &&
      ranked.length > 0;

    return {
      sources: selected,
      notice: staleOnly
        ? "The available search results were older than the preferred freshness window, so OZLIND could not fully verify the latest information."
        : null,
    };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    console.error(
      "OZLIND web research failed:",
      error,
    );

    return {
      sources: [],
      notice:
        "Live web research timed out, so OZLIND continued without it.",
    };
  } finally {
    clearTimeout(timer);

    signal?.removeEventListener(
      "abort",
      abortParent,
    );
  }
}

