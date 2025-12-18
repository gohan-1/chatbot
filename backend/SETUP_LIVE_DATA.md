# Live Data Fetching Setup

This chatbot now fetches warranty and product information directly from the Samsung website (https://www.samsung.com/uk/) instead of relying solely on static text files.

## Features

- **Live Data Fetching**: Automatically fetches warranty information from Samsung's website
- **Smart Caching**: Caches data for 1 hour to avoid too many requests
- **Automatic Fallback**: Falls back to `warranty.txt` file if website is unavailable
- **Product Information**: Can also fetch product information from Samsung's main page

## Installation

1. Install the new dependencies:
   ```bash
   cd backend
   npm install
   ```

   This will install:
   - `axios`: For making HTTP requests
   - `cheerio`: For parsing HTML and extracting data

## How It Works

1. **First Request**: When a warranty question is asked, the system fetches data from https://www.samsung.com/uk/support/warranty/
2. **Caching**: The fetched data is cached for 1 hour to improve performance
3. **Subsequent Requests**: Uses cached data if available and not expired
4. **Fallback**: If the website is unavailable, it uses the `warranty.txt` file

## API Endpoints

### Clear Cache
Force a refresh of warranty data:
```bash
POST http://localhost:3001/api/clear-cache
```

### Get Warranty Data (for testing)
Check what warranty data is currently being used:
```bash
GET http://localhost:3001/api/warranty-data
```

## Configuration

The cache duration can be modified in `scraper.js`:
```javascript
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
```

## Notes

- The scraper respects the website's structure and extracts warranty information
- If the Samsung website structure changes, the scraper may need updates
- The system always falls back to `warranty.txt` if web scraping fails
- Caching prevents excessive requests to Samsung's servers

## Testing

1. Start the server:
   ```bash
   npm start
   ```

2. Ask a warranty question in the chatbot

3. Check the console logs to see if data is being fetched from the website or using cache/file

4. To force a fresh fetch, call the clear-cache endpoint:
   ```bash
   curl -X POST http://localhost:3001/api/clear-cache
   ```

