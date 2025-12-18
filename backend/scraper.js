/**
 * Web Scraper for Samsung Website
 * Fetches warranty and product information from live Samsung website
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Cache configuration
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
let warrantyCache = {
  data: null,
  timestamp: null
};

/**
 * Fetch warranty information from Samsung warranty page
 * @returns {Promise<string>} Warranty information as formatted text
 */
async function fetchWarrantyFromWebsite() {
  try {
    const url = 'https://www.samsung.com/uk/support/warranty/';
    console.log('Fetching warranty data from:', url);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000 // 10 second timeout
    });

    const $ = cheerio.load(response.data);
    let warrantyInfo = 'SAMSUNG WARRANTY INFORMATION - COMPREHENSIVE GUIDE\n\n';
    warrantyInfo += '=== STANDARD WARRANTY ===\n';
    warrantyInfo += 'All Samsung products come with a standard manufacturer\'s warranty.\n\n';

    // Extract warranty information from the page
    warrantyInfo += '=== MOBILE DEVICES WARRANTY ===\n\n';
    
    // Product warranty mapping (from the actual Samsung warranty page structure)
    const productWarrantyMap = {
      // Mobile Devices
      'smartphone': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'tablet': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'galaxy buds': { period: '12 Months', services: ['In-store repair', 'Pick up repair'] },
      'wireless headphones': { period: '12 Months', services: ['In-store repair', 'Pick up repair'] },
      'galaxy watch': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'gear smart watch': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'galaxy ring': { period: '12 Months', services: ['Pick up repair'] },
      'charger': { period: '12 Months', services: ['In-store repair', 'Pick up repair'] },
      'battery': { period: '12 Months', services: ['In-store repair', 'Pick up repair'] },
      'wired headphones': { period: '12 Months', services: ['In-store repair', 'Pick up repair'] },
      'watch strap': { period: '6 Months', services: ['In-store repair', 'Pick up repair'] },
      's pen': { period: '12 Months', services: ['In-store repair', 'Pick up repair'] },
      // Home Appliances
      'cooker hood': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'hood': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'robotic vacuum cleaners': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'robotic vacuum': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'vacuum cleaners': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'vacuum cleaner': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      // Display Products
      'large format display': { period: '36 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'set back box': { period: '36 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'sbb': { period: '36 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'monitor': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'monitor for consumers': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'oled monitor': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] },
      'oled monitor for consumers': { period: '24 Months', services: ['In-store repair', 'Pick up repair', 'Doorstep repair'] }
    };

    // Try to extract warranty information from the page content
    // Look for structured warranty data
    $('strong, h3, h4, li, p').each((i, elem) => {
      const text = $(elem).text().trim();
      const textLower = text.toLowerCase();
      
      // Check if this mentions a product and warranty period
      for (const [productKey, warrantyData] of Object.entries(productWarrantyMap)) {
        if (textLower.includes(productKey)) {
          // Check if warranty period is mentioned nearby
          const parentText = $(elem).parent().text().toLowerCase();
          const nextText = $(elem).next().text().toLowerCase();
          const combinedText = (parentText + ' ' + nextText).toLowerCase();
          
          if (combinedText.includes('warranty period') || combinedText.includes('months')) {
            const productName = productKey.toUpperCase();
            warrantyInfo += `${productName}:\n`;
            warrantyInfo += `- Warranty period: ${warrantyData.period}\n`;
            warrantyInfo += `- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n`;
            warrantyInfo += `- Repair services available: ${warrantyData.services.join(', ')}\n\n`;
            break; // Found it, move to next
          }
        }
      }
    });

    // If we didn't find structured data, use the known warranty periods
    if (!warrantyInfo.includes('SMARTPHONE:') && !warrantyInfo.includes('COOKER HOOD:')) {
      // Add known warranty information for Home Appliances
      warrantyInfo += '=== HOME APPLIANCES WARRANTY ===\n\n';
      warrantyInfo += 'COOKER HOOD:\n';
      warrantyInfo += '- Warranty period: 24 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: In-store repair, Pick up repair, Doorstep repair\n\n';
      
      warrantyInfo += 'ROBOTIC VACUUM CLEANERS:\n';
      warrantyInfo += '- Warranty period: 24 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: In-store repair, Pick up repair, Doorstep repair\n\n';
      
      warrantyInfo += 'VACUUM CLEANERS:\n';
      warrantyInfo += '- Warranty period: 24 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: In-store repair, Pick up repair, Doorstep repair\n\n';
      
      // Add known warranty information for Mobile Devices
      warrantyInfo += '=== MOBILE DEVICES WARRANTY ===\n\n';
      warrantyInfo += 'SMARTPHONE (including Certified Re-Newed model):\n';
      warrantyInfo += '- Warranty period: 24 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: In-store repair, Pick up repair, Doorstep repair\n\n';
      
      warrantyInfo += 'TABLET:\n';
      warrantyInfo += '- Warranty period: 24 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: In-store repair, Pick up repair, Doorstep repair\n\n';
      
      warrantyInfo += 'GALAXY BUDS AND WIRELESS HEADPHONES:\n';
      warrantyInfo += '- Warranty period: 12 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: In-store repair, Pick up repair\n\n';
      
      warrantyInfo += 'GALAXY AND GEAR SMART WATCH:\n';
      warrantyInfo += '- Warranty period: 24 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: In-store repair, Pick up repair, Doorstep repair\n\n';
      
      warrantyInfo += 'GALAXY RING:\n';
      warrantyInfo += '- Warranty period: 12 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: Pick up repair\n\n';
      
      // Add Display Products warranty information
      warrantyInfo += '=== DISPLAY PRODUCTS WARRANTY ===\n\n';
      warrantyInfo += 'LARGE FORMAT DISPLAY:\n';
      warrantyInfo += '- Warranty period: 36 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: In-store repair, Pick up repair, Doorstep repair\n\n';
      
      warrantyInfo += 'SET BACK BOX - SBB:\n';
      warrantyInfo += '- Warranty period: 36 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: In-store repair, Pick up repair, Doorstep repair\n\n';
      
      warrantyInfo += 'MONITOR (FOR CONSUMERS):\n';
      warrantyInfo += '- Warranty period: 24 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: In-store repair, Pick up repair, Doorstep repair\n\n';
      
      warrantyInfo += 'OLED MONITOR (FOR CONSUMERS):\n';
      warrantyInfo += '- Warranty period: 24 Months\n';
      warrantyInfo += '- Warranty service offered: Our Samsung Authorised Service Partners offer both In and Out of warranty repairs.\n';
      warrantyInfo += '- Repair services available: In-store repair, Pick up repair, Doorstep repair\n\n';
    }

    // Extract FAQ information from the page
    warrantyInfo += '=== WARRANTY FAQs ===\n\n';
    
    // Look for FAQ sections - buttons with questions
    const faqs = [];
    $('button, [role="button"], h2, h3').each((i, elem) => {
      const text = $(elem).text().trim();
      const textLower = text.toLowerCase();
      
      // Check if this looks like a FAQ question
      if (text.length > 10 && text.length < 200 && 
          (textLower.includes('?') || 
           textLower.includes('can i') || 
           textLower.includes('what') || 
           textLower.includes('how') || 
           textLower.includes('which') ||
           textLower.includes('does') ||
           textLower.includes('will'))) {
        
        // Try to find the answer - look in next sibling or parent
        let answer = '';
        const $next = $(elem).next();
        const $parent = $(elem).parent();
        
        // Look for answer in next elements
        if ($next.length > 0) {
          const nextText = $next.text().trim();
          if (nextText.length > 20 && nextText.length < 1000) {
            answer = nextText;
          }
        }
        
        // Look in parent's next sibling
        if (!answer && $parent.next().length > 0) {
          const parentNextText = $parent.next().text().trim();
          if (parentNextText.length > 20 && parentNextText.length < 1000) {
            answer = parentNextText;
          }
        }
        
        if (answer) {
          faqs.push({ question: text, answer: answer });
        }
      }
    });
    
    // Add FAQs to warranty info
    faqs.forEach((faq, index) => {
      if (index < 20) { // Limit to 20 FAQs
        warrantyInfo += `Q: ${faq.question}\n`;
        warrantyInfo += `A: ${faq.answer}\n\n`;
      }
    });
    
    // Add general warranty information
    warrantyInfo += '=== GENERAL WARRANTY INFORMATION ===\n';
    warrantyInfo += 'To obtain warranty service, the original proof of purchase will be required and the serial number affixed to the product must be complete and undamaged.\n';
    warrantyInfo += 'The warranty covers defects in materials and workmanship.\n';
    warrantyInfo += 'You can register your Samsung product online through My Page to receive faster support.\n\n';

    warrantyInfo += '=== TROUBLESHOOTING AND REPAIRS ===\n';
    warrantyInfo += 'Need help with your product? Try our online troubleshooter to resolve the problem. If it hasn\'t solved the issue you\'re experiencing, you can book a repair online too.\n\n';

    warrantyInfo += '=== CONTACT INFORMATION ===\n';
    warrantyInfo += 'For support buying a product, help with an order or technical product support, please contact Samsung using the details in the Contact Us section.\n';
    warrantyInfo += 'Troubleshoot and book a repair: https://www.samsung.com/uk/support/repair/\n';
    warrantyInfo += 'Contact us: https://www.samsung.com/uk/support/contact/\n';

    console.log('Successfully fetched warranty data from website');
    return warrantyInfo;

  } catch (error) {
    console.error('Error fetching warranty from website:', error.message);
    throw error;
  }
}

/**
 * Fetch product information from Samsung main page
 * @returns {Promise<string>} Product information as formatted text
 */
async function fetchProductsFromWebsite() {
  try {
    const url = 'https://www.samsung.com/uk/';
    console.log('Fetching product data from:', url);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    let productInfo = 'SAMSUNG PRODUCTS INFORMATION\n\n';

    // Extract featured products
    productInfo += '=== FEATURED PRODUCTS ===\n';
    $('h2, h3, [class*="product"], [class*="galaxy"]').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 3 && text.length < 100) {
        const textLower = text.toLowerCase();
        if (textLower.includes('galaxy') || 
            textLower.includes('samsung') ||
            textLower.includes('tab') ||
            textLower.includes('watch') ||
            textLower.includes('buds')) {
          productInfo += `- ${text}\n`;
        }
      }
    });

    productInfo += '\n=== PRODUCT CATEGORIES ===\n';
    productInfo += '- Mobile: Galaxy Smartphone, Galaxy Tab, Galaxy Book, Galaxy Watch, Galaxy Buds, Galaxy Ring\n';
    productInfo += '- TV & AV: Neo QLED, OLED, QLED, Crystal UHD, The Frame, Sound Devices\n';
    productInfo += '- Appliances: Refrigerators, Ovens, Microwaves, Dishwashers, Laundry, Vacuums\n';
    productInfo += '- Computers & Monitors: Galaxy Book, Monitors, Memory & Storage\n';
    productInfo += '- Wearables: Galaxy Watch, Galaxy Buds, Galaxy Ring\n';
    productInfo += '- Accessories: Various accessories for all product categories\n';

    console.log('Successfully fetched product data from website');
    return productInfo;

  } catch (error) {
    console.error('Error fetching products from website:', error.message);
    throw error;
  }
}

/**
 * Get warranty information with caching
 * Fetches from website if cache is expired, otherwise returns cached data
 * Falls back to warranty.txt file if website fetch fails
 * @returns {Promise<string>} Warranty information
 */
async function getWarrantyWithCache() {
  const now = Date.now();
  
  // Check if cache is valid
  if (warrantyCache.data && warrantyCache.timestamp && (now - warrantyCache.timestamp) < CACHE_DURATION) {
    console.log('Using cached warranty data');
    return warrantyCache.data;
  }

  try {
    // Try to fetch from website
    const warrantyData = await fetchWarrantyFromWebsite();
    warrantyCache.data = warrantyData;
    warrantyCache.timestamp = now;
    console.log('Warranty data cached successfully');
    return warrantyData;
  } catch (error) {
    console.log('Failed to fetch from website, falling back to warranty.txt file');
    // Fallback to file
    try {
      const warrantyPath = path.join(__dirname, 'data', 'warranty.txt');
      if (fs.existsSync(warrantyPath)) {
        const fileData = fs.readFileSync(warrantyPath, 'utf8');
        // Cache the file data so we don't keep trying the website
        warrantyCache.data = fileData;
        warrantyCache.timestamp = now;
        return fileData;
      }
    } catch (fileError) {
      console.error('Error reading warranty file:', fileError);
    }
    throw error;
  }
}

/**
 * Get product information with caching
 * @returns {Promise<string>} Product information
 */
async function getProductsWithCache() {
  try {
    return await fetchProductsFromWebsite();
  } catch (error) {
    console.error('Error fetching products:', error);
    return 'Product information is currently unavailable. Please visit https://www.samsung.com/uk/ for the latest products.';
  }
}

/**
 * Clear the warranty cache (useful for testing or forcing refresh)
 */
function clearWarrantyCache() {
  warrantyCache = {
    data: null,
    timestamp: null
  };
  console.log('Warranty cache cleared');
}

module.exports = {
  getWarrantyWithCache,
  getProductsWithCache,
  fetchWarrantyFromWebsite,
  fetchProductsFromWebsite,
  clearWarrantyCache
};

