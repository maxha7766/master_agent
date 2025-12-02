/**
 * API Route: Search Card Pricing
 * Uses Firecrawl to scrape eBay sold listings for card pricing data
 * Uses Claude Haiku to filter results by confidence match
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const FIRECRAWL_API_KEY = 'fc-ccab965a27904fca9071495c978967c6';
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface SoldCard {
  title: string;
  price: string;
  grade: string;
  status: string;
  date?: string;
  url?: string;
  confidence?: number;
  matchDetails?: {
    year: boolean;
    brand: boolean;
    cardNumber: boolean;
    player: boolean;
    attributes: boolean;
    grade: boolean;
  };
}

interface CardData {
  card_year: number;
  brand: string;
  card_number: string;
  player_name: string;
  attributes: string | null;
  grade: string;
}

interface LLMResult {
  index: number;
  confidence: number;
  matchDetails: {
    year: boolean;
    brand: boolean;
    cardNumber: boolean;
    player: boolean;
    attributes: boolean;
    grade: boolean;
  };
  notes: string;
}

// Parse eBay sold listings markdown to extract card data
function parseEbaySoldListings(markdown: string): SoldCard[] {
  const cards: SoldCard[] = [];

  // Split by "Sold" date markers to get individual listings
  // Pattern: "Sold Nov 29, 2025" followed by listing title and price
  const listingPattern = /Sold\s+([A-Za-z]+\s+\d+,\s+\d{4})\s*\n\s*\[([^\]]+)\][^\n]*\n[^$]*?\$(\d+[\d,.]*)/g;

  let match;
  while ((match = listingPattern.exec(markdown)) !== null) {
    const dateStr = match[1];
    const title = match[2];
    const price = `$${match[3]}`;

    // Extract grade from title
    const gradeMatch = title.match(/PSA\s*\d+|SGC\s*\d+|BGS\s*[\d.]+/i);
    const grade = gradeMatch ? gradeMatch[0] : 'N/A';

    // Extract URL if present (nearby in the markdown)
    const urlMatch = markdown.slice(match.index, match.index + 500).match(/https:\/\/www\.ebay\.com\/itm\/\d+/);

    // Clean up title - remove "Opens in a new window or tab" suffix
    const cleanTitle = title.trim().replace(/Opens in a new window or tab$/i, '').trim();

    cards.push({
      title: cleanTitle,
      price,
      grade,
      status: 'Sold',
      date: dateStr,
      url: urlMatch ? urlMatch[0] : undefined,
    });
  }

  return cards;
}

// Filter results using Claude Haiku for confidence scoring
async function filterWithLLM(cards: SoldCard[], targetCard: CardData): Promise<SoldCard[]> {
  if (!ANTHROPIC_API_KEY) {
    console.log('⚠️ No Anthropic API key - skipping LLM filtering');
    return cards;
  }

  if (cards.length === 0) {
    return cards;
  }

  const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
  });

  // Build the listings list for the prompt
  const listingsText = cards
    .slice(0, 20) // Limit to first 20 to keep tokens reasonable
    .map((card, i) => `${i + 1}. "${card.title}"`)
    .join('\n');

  const prompt = `You are comparing eBay listing titles to a target card. Score each listing's match confidence (0-100).

IMPORTANT: Be STRICT about parallel matching. Study the examples below carefully before scoring.
${targetCard.attributes ? `The target has parallel "${targetCard.attributes}". A listing MUST contain "${targetCard.attributes}" or "Ray Wave" (if Raywave) to score above 70%. No parallel mentioned = Base card = 70%.` : ''}

TARGET CARD:
- Year: ${targetCard.card_year}
- Brand: ${targetCard.brand}
- Card Number: ${targetCard.card_number}
- Player: ${targetCard.player_name}
- Attributes/Parallel: ${targetCard.attributes || 'None (Base card)'}
- Grade: ${targetCard.grade}

LISTINGS TO EVALUATE:
${listingsText}

For each listing, return JSON array (no markdown, just raw JSON):
[
  {
    "index": 1,
    "confidence": 98,
    "matchDetails": {
      "year": true,
      "brand": true,
      "cardNumber": true,
      "player": true,
      "attributes": true,
      "grade": true
    },
    "notes": "Ray Wave = Raywave, exact match"
  }
]

SCORING RULES:
- Player name MUST be in the title (if missing, confidence = 0)
- Year MUST match exactly (25% weight)
- Brand MUST match: Topps Chrome ≠ Bowman Chrome. Topps Chrome ≈ Topps Chrome Update is acceptable if other fields match (25% weight)
- Card Number should match if present in listing (20% weight)
- Attributes/Parallel MUST match exactly: Raywave ≠ Green ≠ Prism ≠ Aqua. "Ray Wave" = "Raywave" is OK (20% weight)
- Grade matching is lower priority but still matters: PSA 9 ≠ PSA 10 (10% weight)
- If target has attributes like "Raywave" but listing has different parallel (Green, Aqua, Prism), that's a FAIL on attributes
- 100% = perfect match, 90-99% = minor variations acceptable, <90% = significant mismatch

CRITICAL PARALLEL RULES:
- If target has a parallel (e.g., "Raywave"), the listing MUST explicitly mention that same parallel
- A listing with NO parallel mentioned is a BASE CARD → 70% (wrong parallel: Base ≠ Raywave)
- Gold, X-Fractor, SP Variation, Refractor, etc. are ALL DIFFERENT parallels → each is 70%
- "2024 Topps Chrome #50 Aaron Judge PSA 9" with NO parallel = BASE = 70% when target is Raywave
- Only "Raywave" or "Ray Wave" in the title counts as a match for Raywave target

=== EXAMPLE ONE (One Match out of 17) ===
TARGET: 2024 Topps Chrome #50 Aaron Judge Raywave PSA 9
LISTINGS:
1. "2024 Topps Chrome Sapphire Aaron Judge #50 PSA 9 Gem Mint" → 70% (wrong parallel: Sapphire ≠ Raywave)
2. "2024 Topps Chrome Black Aaron Judge #50 PSA 9" → 70% (wrong parallel: Black ≠ Raywave)
3. "2024 Topps Chrome Aaron Judge #50 Base PSA 9" → 70% (wrong parallel: Base ≠ Raywave)
4. "2024 Topps Chrome #50 Aaron Judge PSA 9" → 70% (NO PARALLEL MENTIONED = Base card ≠ Raywave)
5. "2024 Topps Chrome Baseball - Aaron Judge - #50 - PSA 9" → 70% (NO PARALLEL = Base ≠ Raywave)
6. "2024 Topps Chrome Aaron Judge #50 Yankees" → 70% (NO PARALLEL = Base ≠ Raywave, also no grade)
7. "2024 Topps Chrome #50 Aaron Judge PSA 10 GEM MINT" → 70% (NO PARALLEL = Base ≠ Raywave)
8. "2024 Topps Chrome AARON JUDGE #50 SP Variation - Gold /50 - PSA 9" → 70% (wrong parallel: Gold SP ≠ Raywave)
9. "2024 Topps Chrome Aaron Judge X Fractor #50" → 70% (wrong parallel: X Fractor ≠ Raywave)
10. "2024 TOPPS CHROME #50 AARON JUDGE /99 GREEN RAYWAVE PSA 9" → 70% (wrong parallel: GREEN Raywave is a different card than Raywave)
11. "2023 Topps Chrome Ray Wave Aaron Judge PSA 9" → 70% (wrong year: 2023 ≠ 2024)
12. "2024 Bowman Chrome Raywave Aaron Judge PSA 9" → 70% (wrong brand: Bowman ≠ Topps)
13. "2024 Topps Chrome Raywave Juan Soto #50 PSA 9" → 0% (wrong player)
14. "2024 Topps Chrome Green Aaron Judge #50 PSA 9" → 70% (wrong parallel: Green ≠ Raywave)
15. "2024 Topps Chrome Update Raywave Aaron Judge PSA 9" → 85% (Chrome Update ≈ Chrome, slight penalty)
16. "2024 Topps Chrome Aaron Judge Raywave SGC 9" → 85% (different grading company)
17. "2024 Topps Chrome Ray Wave Aaron Judge #50 PSA 9 Mint Yankees" → 98% (MATCH: Ray Wave = Raywave, all fields match)

=== EXAMPLE TWO (All Matches) ===
TARGET: 2017 Topps Heritage #214 Aaron Judge Rookie PSA 10
LISTINGS:
1. "2017 Topps Heritage Aaron Judge #214 RC PSA 10" → 98% (MATCH: RC = Rookie)
2. "2017 Topps Heritage #214 Aaron Judge Rookie Card PSA 10" → 98% (MATCH: all fields)
3. "2017 Topps Heritage Aaron Judge Rookie PSA 10 Gem Mint #214" → 98% (MATCH: reordered but same)
4. "PSA 10 2017 Topps Heritage Aaron Judge RC #214" → 98% (MATCH: reordered)
5. "2017 Topps Heritage #214 A. Judge Rookie PSA 10" → 95% (MATCH: A. Judge = Aaron Judge)
6. "2017 Topps Heritage Aaron Judge 214 Rookie PSA 10 GEM" → 98% (MATCH: # symbol not required)

=== EXAMPLE THREE (No Matches) ===
TARGET: 2022 Panini Prizm #52 Nick Chubb Green Rookie PSA 10
LISTINGS:
1. "2022 Panini Prizm Nick Chubb Silver #52 RC PSA 10" → 70% (wrong parallel: Silver ≠ Green)
2. "2022 Panini Prizm Nick Chubb Base #52 RC PSA 10" → 70% (wrong parallel: Base ≠ Green)
3. "2022 Panini Prizm Green Joe Burrow #1 RC PSA 10" → 0% (wrong player)
4. "2021 Panini Prizm Nick Chubb Green #52 PSA 10" → 70% (wrong year: 2021 ≠ 2022)
5. "2022 Donruss Optic Nick Chubb Green #52 PSA 10" → 70% (wrong brand: Donruss Optic ≠ Panini Prizm)
6. "2022 Panini Prizm Nick Chubb Red White Blue #52 RC PSA 10" → 70% (wrong parallel: Red White Blue ≠ Green)

Return ONLY the JSON array, no other text.`;

  try {
    console.log('🤖 Calling Claude Haiku for confidence scoring...');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      console.error('No text response from Claude');
      return cards;
    }

    // Parse the JSON response
    const jsonText = textContent.text.trim();
    let results: LLMResult[];

    try {
      results = JSON.parse(jsonText);
    } catch {
      // Try to extract JSON from the response if it's wrapped in markdown
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
      } else {
        console.error('Failed to parse LLM response as JSON:', jsonText.slice(0, 200));
        return cards;
      }
    }

    console.log(`✅ Got ${results.length} confidence scores from LLM`);

    // Merge confidence scores back into cards
    const scoredCards = cards.slice(0, 20).map((card, i) => {
      const result = results.find(r => r.index === i + 1);
      if (result) {
        return {
          ...card,
          confidence: result.confidence,
          matchDetails: result.matchDetails,
        };
      }
      return card;
    });

    // Filter to only 90%+ confidence and sort by confidence desc
    const filtered = scoredCards
      .filter(card => card.confidence && card.confidence >= 90)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    console.log(`📊 ${filtered.length} cards passed 90% confidence threshold`);

    return filtered;
  } catch (error) {
    console.error('LLM filtering error:', error);
    // Return unfiltered cards if LLM fails
    return cards;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchDescription, cardData } = body;

    if (!searchDescription) {
      return NextResponse.json(
        { error: 'searchDescription is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Searching eBay sold listings for: ${searchDescription}`);

    // Build eBay sold listings URL
    const searchTerms = encodeURIComponent(searchDescription);
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${searchTerms}&LH_Complete=1&LH_Sold=1&_sop=13`;

    console.log(`📦 Scraping: ${ebayUrl}`);

    // Scrape eBay sold listings page
    const scrapeResponse = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: ebayUrl,
        formats: ['markdown'],
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error('Firecrawl scrape error:', errorText);
      return NextResponse.json(
        { error: `Firecrawl scrape failed: ${scrapeResponse.status}` },
        { status: 500 }
      );
    }

    const scrapeData = await scrapeResponse.json();
    const markdown = scrapeData.data?.markdown || '';

    console.log(`📄 Got ${markdown.length} chars of markdown`);

    // Parse sold listings from markdown
    let soldCards = parseEbaySoldListings(markdown);
    console.log(`✅ Found ${soldCards.length} sold listings`);

    // If no sold cards found with pattern, try alternative extraction
    if (soldCards.length === 0) {
      // Fallback: Look for price patterns in the markdown
      const priceMatches = markdown.matchAll(/\[([^\]]+(?:PSA|SGC|BGS)[^\]]*)\][^\n]*\n[^$]*?\$(\d+[\d,.]*)/gi);
      for (const match of priceMatches) {
        const title = match[1];
        const price = `$${match[2]}`;
        const gradeMatch = title.match(/PSA\s*\d+|SGC\s*\d+|BGS\s*[\d.]+/i);

        soldCards.push({
          title: title.trim(),
          price,
          grade: gradeMatch ? gradeMatch[0] : 'N/A',
          status: 'Sold',
        });

        if (soldCards.length >= 20) break;
      }
    }

    // Apply LLM filtering if cardData is provided
    if (cardData && soldCards.length > 0) {
      soldCards = await filterWithLLM(soldCards, cardData);
    }

    return NextResponse.json({
      searchDescription,
      cards: soldCards.slice(0, 15),
      searchedAt: new Date().toISOString(),
      totalResults: soldCards.length,
      source: 'eBay Sold Listings',
      filtered: !!cardData,
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
