import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

export interface SearchResultItem {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
}

export interface SearchResponse {
  items: SearchResultItem[];
  nextPageToken?: string;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class BoundedTtlCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  constructor(private maxEntries: number = 100, private defaultTtlMs: number = 30 * 60 * 1000) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh LRU order: delete & re-insert
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

@Injectable()
export class YoutubeService {
  // 24-hour search cache with capacity of 1000 queries
  private cache = new BoundedTtlCache<SearchResponse>(1000, 24 * 60 * 60 * 1000);
  // 7-day video details cache with capacity of 2000 videos
  private videoCache = new BoundedTtlCache<SearchResultItem>(2000, 7 * 24 * 60 * 60 * 1000);
  private readonly apiKey = process.env.YOUTUBE_API_KEY;

  // A premium collection of royalty-free lofi/synthwave tracks for offline/missing key testing
  private readonly mockSongs: SearchResultItem[] = [
    {
      videoId: '5qap5aO4i9A',
      title: 'Lofi Hip Hop Radio 🌌 Beats to Relax/Study to',
      description: 'ChilledCow lofi hip hop radio - beats to relax/study to.',
      thumbnail: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80',
      channelTitle: 'Lofi Girl',
    },
    {
      videoId: 'D7aYjAp_nsU',
      title: 'Synthwave Radio ⚡ Retro Futurism & Synth Beats',
      description: 'Synthesizer retro wave beats to cruise to.',
      thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
      channelTitle: 'Lofi Records',
    },
    {
      videoId: 'C5A2C87V-rA',
      title: 'Deep Focus Ambient Music 🧘 Clean Instrumental Waves',
      description: 'Beautiful synth ambient music for focusing, working, or sleeping.',
      thumbnail: 'https://images.unsplash.com/photo-1497496273947-601e60f77e6f?w=400&q=80',
      channelTitle: 'Ambient Waves',
    },
    {
      videoId: 'tntOCGkgt98',
      title: 'Jazz Hop Cafe Beats ☕ Cozy Afternoon Lounge',
      description: 'Smooth jazz hop beats for relaxation.',
      thumbnail: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=400&q=80',
      channelTitle: 'Coffee Shop Vibes',
    },
    {
      videoId: 'F7X3VbZtX9g',
      title: 'Cyberpunk Industrial Techno Mix 🤖 Future City Sounds',
      description: 'Energetic futuristic beats.',
      thumbnail: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80',
      channelTitle: 'Synth Records',
    }
  ];

  async search(query: string, pageToken?: string, maxResults = 10): Promise<SearchResponse> {
    const rawTrimmed = query.trim();
    
    // Fast-path: Check if the search query is actually a direct YouTube URL or 11-char video ID
    // Avoids 100 quota units for search.list
    const urlMatch = rawTrimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/);
    const directVideoId = urlMatch ? urlMatch[1] : (/^[A-Za-z0-9_-]{11}$/.test(rawTrimmed) ? rawTrimmed : null);
    
    if (directVideoId) {
      try {
        const video = await this.getVideo(directVideoId);
        return { items: [video] };
      } catch (e) {
        // Fall back to standard search if video lookup fails
      }
    }

    const cleanQuery = rawTrimmed.toLowerCase().replace(/\s+/g, ' ');
    const cacheKey = `${cleanQuery}_${pageToken || ''}_${maxResults}`;

    if (this.cache.has(cacheKey)) {
      console.log(`[YouTube Search] Serving cached results (24h TTL) for: "${cleanQuery}"`);
      return this.cache.get(cacheKey)!;
    }

    // Fallback if API key is not provided
    if (!this.apiKey) {
      console.warn('[YouTube Search] YOUTUBE_API_KEY is missing. Serving mock fallback results.');
      const filtered = this.mockSongs.filter(
        (song) =>
          song.title.toLowerCase().includes(cleanQuery) ||
          song.description.toLowerCase().includes(cleanQuery) ||
          song.channelTitle.toLowerCase().includes(cleanQuery)
      );
      
      const items = filtered.length > 0 ? filtered : this.mockSongs;
      return { items };
    }

    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: query,
          type: 'video',
          key: this.apiKey,
          maxResults,
          pageToken,
          videoEmbeddable: 'true', // Filter for videos that can be embedded in an iframe
        },
      });

      const items: SearchResultItem[] = response.data.items.map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        channelTitle: item.snippet.channelTitle,
      }));

      const searchResponse: SearchResponse = {
        items,
        nextPageToken: response.data.nextPageToken,
      };

      // Store in 24h cache
      this.cache.set(cacheKey, searchResponse);

      return searchResponse;
    } catch (error) {
      console.error('[YouTube Search] API query error:', error.message);
      
      // Fallback on failure or quota exceeded
      console.warn('[YouTube Search] Serving mock fallback results due to search API error.');
      const filtered = this.mockSongs.filter(
        (song) =>
          song.title.toLowerCase().includes(cleanQuery) ||
          song.description.toLowerCase().includes(cleanQuery) ||
          song.channelTitle.toLowerCase().includes(cleanQuery)
      );
      
      const items = filtered.length > 0 ? filtered : this.mockSongs;
      return { items };
    }
  }

  async getVideo(videoId: string): Promise<SearchResultItem> {
    const cleanId = videoId.trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(cleanId)) {
      throw new HttpException('Invalid YouTube video ID format', HttpStatus.BAD_REQUEST);
    }

    if (this.videoCache.has(cleanId)) {
      return this.videoCache.get(cleanId)!;
    }

    // 0-quota fast path: YouTube oEmbed endpoint (official, free, zero API quota)
    try {
      const oembedRes = await axios.get(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${cleanId}&format=json`,
        { timeout: 3500 }
      );
      if (oembedRes.data && oembedRes.data.title) {
        const result: SearchResultItem = {
          videoId: cleanId,
          title: oembedRes.data.title,
          description: `Video by ${oembedRes.data.author_name || 'YouTube'}`,
          thumbnail: oembedRes.data.thumbnail_url || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`,
          channelTitle: oembedRes.data.author_name || 'YouTube',
        };
        this.videoCache.set(cleanId, result);
        return result;
      }
    } catch (oembedErr) {
      // If oEmbed fails, proceed to Google API or fallback
    }

    if (!this.apiKey) {
      const found = this.mockSongs.find((s) => s.videoId === cleanId);
      if (found) return found;
      return {
        videoId: cleanId,
        title: 'Pasted YouTube Video',
        description: 'Autogenerated metadata for pasted YouTube link',
        thumbnail: `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`,
        channelTitle: 'Snyx Guest',
      };
    }

    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'snippet',
          id: cleanId,
          key: this.apiKey,
        },
      });

      const item = response.data.items?.[0];
      if (!item) {
        throw new HttpException('Video not found on YouTube', HttpStatus.NOT_FOUND);
      }

      const result: SearchResultItem = {
        videoId: cleanId,
        title: item.snippet.title,
        description: item.snippet.description || '',
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`,
        channelTitle: item.snippet.channelTitle,
      };
      this.videoCache.set(cleanId, result);
      return result;
    } catch (error) {
      console.error('[YouTube Search] Details API error:', error.message);
      return {
        videoId: cleanId,
        title: 'YouTube Video',
        description: 'Metadata fallback due to YouTube API limit/failure',
        thumbnail: `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`,
        channelTitle: 'Snyx System',
      };
    }
  }
}
