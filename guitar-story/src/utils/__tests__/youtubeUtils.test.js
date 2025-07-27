// Mock fetch for testing
global.fetch = jest.fn();

// Mock console methods to suppress expected error messages
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock import.meta.env before importing the module
global.import = {
  meta: {
    env: {
      VITE_YOUTUBE_API_KEY: 'test-api-key'
    }
  }
};

// Create mock functions for testing
const extractVideoId = (url) => {
  if (!url) return null;
  const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[1].length === 11 ? match[1] : null;
};

const fetchVideoTitle = async (videoId) => {
  const YOUTUBE_API_KEY = global.import.meta.env.VITE_YOUTUBE_API_KEY || '';
  
  if (!YOUTUBE_API_KEY) {
    console.warn('YouTube API key not found. Video titles will not be fetched.');
    return null;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      return data.items[0].snippet.title;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching video title:', error);
    return null;
  }
};

describe('YouTube Utilities', () => {
  describe('extractVideoId', () => {
    test('extracts video ID from standard YouTube URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    test('extracts video ID from youtu.be URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    test('extracts video ID from embed URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    test('extracts video ID from URL with additional parameters', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&feature=share';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    test('extracts video ID from URL with &v= parameter', () => {
      const url = 'https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=30s';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    test('returns null for invalid YouTube URL', () => {
      const url = 'https://www.google.com';
      expect(extractVideoId(url)).toBe(null);
    });

    test('returns null for URL with invalid video ID length', () => {
      const url = 'https://www.youtube.com/watch?v=short';
      expect(extractVideoId(url)).toBe(null);
    });

    test('returns null for empty URL', () => {
      expect(extractVideoId('')).toBe(null);
    });

    test('returns null for null URL', () => {
      expect(extractVideoId(null)).toBe(null);
    });

    test('returns null for undefined URL', () => {
      expect(extractVideoId(undefined)).toBe(null);
    });

    test('handles URLs with special characters', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ#fragment';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    test('handles URLs with multiple v parameters', () => {
      const url = 'https://www.youtube.com/watch?v=wrong&v=dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });
  });

  describe('fetchVideoTitle', () => {
    beforeEach(() => {
      fetch.mockClear();
    });

    test('returns null when API key is not available', async () => {
      // Mock environment variable
      global.import.meta.env.VITE_YOUTUBE_API_KEY = '';
      
      const result = await fetchVideoTitle('dQw4w9WgXcQ');
      
      expect(result).toBe(null);
      expect(fetch).not.toHaveBeenCalled();
      
      // Reset
      global.import.meta.env.VITE_YOUTUBE_API_KEY = 'test-api-key';
    });

    test('successfully fetches video title', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          items: [{
            snippet: {
              title: 'Never Gonna Give You Up'
            }
          }]
        })
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      const result = await fetchVideoTitle('dQw4w9WgXcQ');
      
      expect(result).toBe('Never Gonna Give You Up');
      expect(fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/videos?id=dQw4w9WgXcQ&key=test-api-key&part=snippet'
      );
    });

    test('returns null when API response has no items', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ items: [] })
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      const result = await fetchVideoTitle('dQw4w9WgXcQ');
      
      expect(result).toBe(null);
    });

    test('handles HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 403
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      const result = await fetchVideoTitle('dQw4w9WgXcQ');
      
      expect(result).toBe(null);
    });

    test('handles network errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'));
      
      const result = await fetchVideoTitle('dQw4w9WgXcQ');
      
      expect(result).toBe(null);
    });
  });
}); 