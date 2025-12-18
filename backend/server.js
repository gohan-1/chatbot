/**
 * Backend Server for Customer Service Chatbot
 * 
 * This file sets up an Express server that:
 * 1. Receives chat messages from the frontend
 * 2. Sends them to OpenAI's API
 * 3. Returns the AI's response back to the frontend
 */

// Import required modules
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { getWarrantyWithCache, getProductsWithCache, clearWarrantyCache } = require('./scraper');

// Load environment variables from .env file
// This keeps your API key secret and out of your code
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware: Allow requests from frontend (React app)
// CORS = Cross-Origin Resource Sharing - needed for frontend to talk to backend
app.use(cors());

// Middleware: Parse JSON data from requests
// This lets us read the message data sent from the frontend
app.use(express.json());

// AI Service Configuration
// Priority: 1. Hugging Face (FREE, no payment needed), 2. OpenAI (paid), 3. Mock responses
let openai = null;
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USE_OPENAI = OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here';
const USE_HUGGING_FACE = true; // Always use Hugging Face as default (it's free!)

// Initialize OpenAI client if API key is provided
if (USE_OPENAI) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY
  });
}

// Hugging Face API endpoint (FREE - no payment required!)
// Using a reliable free text generation model
const HUGGING_FACE_API_URL = 'https://api-inference.huggingface.co/models/gpt2';

/**
 * Get AI response from Hugging Face (FREE API - no payment needed!)
 * This uses a free text generation model
 */
async function getHuggingFaceResponse(userMessage) {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add API token if provided (optional - works without it too, just lower rate limits)
    if (HUGGING_FACE_API_KEY) {
      headers['Authorization'] = `Bearer ${HUGGING_FACE_API_KEY}`;
    }

    // Create a prompt for customer service
    const prompt = `You are a helpful customer service assistant. User: ${userMessage}\nAssistant:`;

    const response = await fetch(HUGGING_FACE_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 100,
          return_full_text: false,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      // If model is loading, wait and retry
      if (response.status === 503) {
        const data = await response.json();
        if (data.estimated_time) {
          console.log(`Model loading, waiting ${data.estimated_time} seconds...`);
          await new Promise(resolve => setTimeout(resolve, data.estimated_time * 1000 + 2000));
          return getHuggingFaceResponse(userMessage); // Retry
        }
      }
      console.error(`Hugging Face API error: ${response.status}`, await response.text());
      // Use improved mock response instead of failing
      return getImprovedMockResponse(userMessage);
    }

    const data = await response.json();
    
    // Extract the generated text from response
    let generatedText = '';
    if (Array.isArray(data) && data[0] && data[0].generated_text) {
      generatedText = data[0].generated_text.trim();
    } else if (data.generated_text) {
      generatedText = data.generated_text.trim();
    }
    
    // Clean up the response (remove the prompt if it's included)
    if (generatedText) {
      generatedText = generatedText.replace(prompt, '').trim();
      // If we got a good response, return it
      if (generatedText.length > 5) {
        return generatedText;
      }
    }
    
    // Fallback to improved mock response
    return getImprovedMockResponse(userMessage);
  } catch (error) {
    console.error('Hugging Face API error:', error.message);
    // Use improved mock response if API fails
    return getImprovedMockResponse(userMessage);
  }
}

/**
 * Read data from knowledge base files
 * Returns relevant information from data files based on the question topic
 */
function getDataFromFile(topic) {
  try {
    const dataDir = path.join(__dirname, 'data');
    let fileName = '';
    
    // Determine which file to read based on topic
    if (topic === 'returns' || topic === 'return' || topic === 'refund') {
      fileName = 'returns.txt';
    } else if (topic === 'shipping' || topic === 'ship' || topic === 'delivery') {
      fileName = 'shipping.txt';
    } else if (topic === 'payment' || topic === 'pay' || topic === 'billing') {
      fileName = 'payments.txt';
    } else if (topic === 'order' || topic === 'orders' || topic === 'tracking') {
      fileName = 'orders.txt';
    } else if (topic === 'warranty' || topic === 'warranties') {
      fileName = 'warranty.txt';
    } else {
      return null; // No matching file
    }
    
    const filePath = path.join(dataDir, fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Data file not found: ${filePath}`);
      return null;
    }
    
    // Read and return file content
    const data = fs.readFileSync(filePath, 'utf8');
    return data;
  } catch (error) {
    console.error('Error reading data file:', error);
    return null;
  }
}

/**
 * Get warranty knowledge base content
 * This fetches from live website first, then falls back to warranty.txt file
 * Uses caching to avoid too many requests
 */
async function getWarrantyKnowledgeBase() {
  try {
    // Try to get from live website (with caching)
    const warrantyData = await getWarrantyWithCache();
    return warrantyData;
  } catch (error) {
    console.error('Error getting warranty knowledge base:', error);
    // Fallback to file
    try {
      const warrantyPath = path.join(__dirname, 'data', 'warranty.txt');
      if (fs.existsSync(warrantyPath)) {
        return fs.readFileSync(warrantyPath, 'utf8');
      }
    } catch (fileError) {
      console.error('Error reading warranty file:', fileError);
    }
    return null;
  }
}

/**
 * Extract answer from data file based on user question
 */
function getAnswerFromData(userMessage, dataContent) {
  if (!dataContent) return null;
  
  const message = userMessage.toLowerCase();
  const lines = dataContent.split('\n');
  
  // First, try to find product-specific warranty information
  // Look for product names followed by warranty period
  const productKeywords = {
    'tablet': ['tablet', 'tab'],
    'smartphone': ['smartphone', 'phone', 'galaxy'],
    'watch': ['watch', 'gear'],
    'buds': ['buds', 'headphone', 'earphone'],
    'charger': ['charger'],
    'battery': ['battery'],
    's pen': ['s pen', 'spen', 'pen'],
    'strap': ['strap', 'band'],
    'ring': ['ring', 'galaxy ring'],
    'cooker hood': ['cooker hood', 'hood', 'cooker'],
    'vacuum cleaners': ['vacuum cleaners', 'vacuum cleaner', 'vacuum', 'robotic vacuum'],
    'robotic vacuum cleaners': ['robotic vacuum cleaners', 'robotic vacuum'],
    'monitor': ['monitor', 'monitors', 'display', 'monitor for consumers'],
    'large format display': ['large format display', 'large format'],
    'set back box': ['set back box', 'sbb', 'back box'],
    'oled monitor': ['oled monitor', 'oled monitor for consumers', 'oled']
  };
  
  // Find matching product
  let matchedProduct = null;
  for (const [product, keywords] of Object.entries(productKeywords)) {
    if (keywords.some(keyword => message.includes(keyword))) {
      matchedProduct = product;
      break;
    }
  }
  
  // If we found a product, extract its warranty information
  if (matchedProduct) {
    let inProductSection = false;
    let productSection = '';
    let warrantyPeriod = null;
    let repairServices = [];
    let warrantyService = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineLower = line.toLowerCase();
      
      // Check if we're entering a product section
      if (line.match(/^[A-Z\s]+:$/) && !line.includes('===')) {
        const productName = line.replace(':', '').toLowerCase();
        if (productName.includes(matchedProduct) || 
            (matchedProduct === 'tablet' && productName === 'tablet') ||
            (matchedProduct === 'smartphone' && (productName.includes('smartphone') || productName.includes('phone'))) ||
            (matchedProduct === 'watch' && (productName.includes('watch') || productName.includes('gear'))) ||
            (matchedProduct === 'buds' && (productName.includes('buds') || productName.includes('headphone'))) ||
            (matchedProduct === 'charger' && productName.includes('charger')) ||
            (matchedProduct === 'battery' && productName.includes('battery')) ||
            (matchedProduct === 's pen' && productName.includes('pen')) ||
            (matchedProduct === 'strap' && productName.includes('strap')) ||
            (matchedProduct === 'ring' && productName.includes('ring')) ||
            (matchedProduct === 'cooker hood' && (productName.includes('cooker hood') || productName.includes('hood'))) ||
            (matchedProduct === 'vacuum cleaners' && (productName.includes('vacuum') || productName.includes('cleaner'))) ||
            (matchedProduct === 'robotic vacuum cleaners' && (productName.includes('robotic vacuum') || productName.includes('robotic'))) ||
            (matchedProduct === 'monitor' && (productName.includes('monitor') || productName.includes('display'))) ||
            (matchedProduct === 'large format display' && (productName.includes('large format') || productName.includes('format display'))) ||
            (matchedProduct === 'set back box' && (productName.includes('set back box') || productName.includes('sbb') || productName.includes('back box'))) ||
            (matchedProduct === 'oled monitor' && (productName.includes('oled monitor') || productName.includes('oled')))) {
          inProductSection = true;
          productSection = line;
          continue;
        } else if (inProductSection && line.match(/^[A-Z\s]+:$/)) {
          // We've moved to a new section, break
          break;
        }
      }
      
      if (inProductSection) {
        // Extract warranty period
        if (line.match(/- Warranty period:/i)) {
          const match = line.match(/Warranty period:\s*(\d+)\s*Months?/i);
          if (match) {
            warrantyPeriod = match[1] + ' Months';
          }
        }
        
        // Extract warranty service
        if (line.match(/- Warranty service offered:/i)) {
          warrantyService = line.replace(/- Warranty service offered:\s*/i, '').trim();
        }
        
        // Extract repair services
        if (line.match(/- Repair services available:/i)) {
          const nextLines = [];
          for (let j = i + 1; j < lines.length && j < i + 10; j++) {
            const nextLine = lines[j].trim();
            if (nextLine.match(/^- /)) {
              nextLines.push(nextLine.replace(/^- /, ''));
            } else if (nextLine.match(/^[A-Z]/) || nextLine === '') {
              break;
            }
          }
          repairServices = nextLines;
        }
        
        // Stop if we hit another major section
        if (line.startsWith('===') || (line.match(/^[A-Z\s]+:$/) && !line.includes(productSection))) {
          break;
        }
      }
    }
    
    // Build response if we found warranty information
    if (warrantyPeriod) {
      let response = `Warranty period: ${warrantyPeriod}`;
      if (warrantyService) {
        response += `. ${warrantyService}`;
      }
      if (repairServices.length > 0) {
        response += `. Repair services available: ${repairServices.join(', ')}.`;
      }
      return response;
    }
  }
  
  // Look for Q&A sections
  let inQA = false;
  let currentQ = '';
  let currentA = '';
  const qaPairs = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('Q:') || line.startsWith('QUESTIONS ABOUT')) {
      if (currentQ && currentA) {
        qaPairs.push({ question: currentQ, answer: currentA });
      }
      currentQ = line.replace(/^Q:\s*/, '').toLowerCase();
      currentA = '';
      inQA = true;
    } else if (inQA && line.startsWith('A:')) {
      currentA = line.replace(/^A:\s*/, '');
    } else if (inQA && currentA && line.length > 0) {
      currentA += ' ' + line;
    } else if (inQA && line.length === 0 && currentA) {
      inQA = false;
    }
  }
  
  if (currentQ && currentA) {
    qaPairs.push({ question: currentQ, answer: currentA });
  }
  
  // Try to match user question with Q&A pairs (improved matching)
  let bestMatch = null;
  let bestScore = 0;
  
  for (const qa of qaPairs) {
    const qLower = qa.question.toLowerCase();
    const qWords = qLower.split(/\s+/).filter(w => w.length > 2);
    const messageWords = message.split(/\s+/).filter(w => w.length > 2).map(w => w.toLowerCase());
    
    let score = 0;
    
    // Exact phrase matching (highest priority)
    const qPhrase = qLower.replace(/^q:\s*/, '').trim();
    if (message.includes(qPhrase) || qPhrase.includes(message)) {
      score += 100;
    }
    
    // Key word matching - count how many important words match
    const importantWords = qWords.filter(w => 
      w.length > 3 && !['how', 'what', 'when', 'where', 'why', 'can', 'do', 'i', 'my', 'the', 'a', 'an'].includes(w)
    );
    
    const matchingWords = importantWords.filter(qWord => 
      messageWords.some(mWord => {
        // Exact match
        if (mWord === qWord) return true;
        // Contains match (but not too loose)
        if (qWord.length > 4 && (mWord.includes(qWord) || qWord.includes(mWord))) return true;
        return false;
      })
    ).length;
    
    // Score based on matching words
    if (importantWords.length > 0) {
      score += (matchingWords / importantWords.length) * 50;
    }
    
    // Bonus for specific keywords
    if (message.includes('track') && qLower.includes('track')) score += 20;
    if (message.includes('cancel') && qLower.includes('cancel')) score += 20;
    if (message.includes('latest') && qLower.includes('latest')) score += 20;
    if (message.includes('order id') && qLower.includes('order id')) score += 30;
    if (message.includes('all order') && qLower.includes('all order')) score += 30;
    if (message.includes('reorder') && qLower.includes('reorder')) score += 20;
    if (message.includes('change') && qLower.includes('change')) score += 20;
    if (message.includes('wrong item') && qLower.includes('wrong item')) score += 30;
    
    // Penalty for too generic matches
    if (qLower.includes('track') && !message.includes('track') && !message.includes('order')) {
      score -= 10;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = qa;
    }
  }
  
  // Only return if we have a good match (score > 15)
  if (bestMatch && bestScore > 15) {
    return bestMatch.answer;
  }
  
  // If no Q&A match, extract relevant section
  // Look for sections that contain keywords from the question
  const messageWords = message.split(/\s+/).filter(w => w.length > 3);
  let bestSection = '';
  let bestMatchCount = 0;
  let currentSection = '';
  
  for (const line of lines) {
    if (line.match(/^[A-Z\s]+:$/) || line.match(/^===/)) {
      // New section
      if (currentSection && bestMatchCount < 3) {
        const matchCount = messageWords.filter(word => 
          currentSection.toLowerCase().includes(word)
        ).length;
        if (matchCount > bestMatchCount) {
          bestMatchCount = matchCount;
          bestSection = currentSection;
        }
      }
      currentSection = line + '\n';
    } else if (line.trim().length > 0) {
      currentSection += line + '\n';
    }
  }
  
  // Return relevant section or first few paragraphs
  if (bestSection && bestMatchCount > 0) {
    // Extract first 3-5 sentences from best section
    const sentences = bestSection.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 3).join('. ').trim() + '.';
  }
  
  // Fallback: return first relevant paragraph
  const paragraphs = dataContent.split(/\n\n+/).filter(p => p.trim().length > 50);
  let bestPara = '';
  let bestParaMatches = 0;
  
  for (const para of paragraphs) {
    const paraLower = para.toLowerCase();
    const matchCount = messageWords.filter(word => 
      word.length > 3 && paraLower.includes(word)
    ).length;
    if (matchCount > bestParaMatches) {
      bestParaMatches = matchCount;
      bestPara = para;
    }
  }
  
  if (bestPara && bestParaMatches > 0) {
    // Return first 2-3 sentences from best paragraph
    const sentences = bestPara.split(/[.!?]+/).filter(s => s.trim().length > 15);
    return sentences.slice(0, 2).join('. ').trim() + '.';
  }
  
  // Last resort: return ORDER HISTORY section if it exists
  if (dataContent.includes('ORDER HISTORY')) {
    const historyMatch = dataContent.match(/ORDER HISTORY:[\s\S]*?(?=\n[A-Z]|$)/);
    if (historyMatch) {
      return historyMatch[0].replace('ORDER HISTORY:', '').trim().split('\n').slice(0, 3).join(' ').trim();
    }
  }
  
  return null;
}

/**
 * Improved response function that uses data files
 * This provides accurate answers from the knowledge base
 */
function getImprovedMockResponse(userMessage) {
  const message = userMessage.toLowerCase().trim();
  
  // Greetings
  if (message.match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/)) {
    return "Hello! I'm here to help you with returns, shipping, payments, and orders. How can I assist you today?";
  }
  
  // How are you
  if (message.match(/(how are you|how r u|how's it going|how do you do)/)) {
    return "I'm doing great, thank you for asking! I'm here and ready to help you with any questions about returns, shipping, payments, or orders. What can I do for you today?";
  }
  
  // Check for returns/refunds
  if (message.match(/(return|refund|exchange|cancel.*order)/)) {
    const data = getDataFromFile('returns');
    if (data) {
      const answer = getAnswerFromData(userMessage, data);
      if (answer) return answer;
      // Fallback to relevant section
      return "I can help you with returns and refunds. Items can be returned within 30 days of purchase in original condition. Would you like more details about our return policy?";
    }
  }
  
  // Check for shipping/delivery
  if (message.match(/(ship|shipping|delivery|deliver|track|tracking|when.*arrive|how long.*ship)/)) {
    const data = getDataFromFile('shipping');
    if (data) {
      const answer = getAnswerFromData(userMessage, data);
      if (answer) return answer;
      // Fallback
      return "Standard shipping takes 5-7 business days. Express is 2-3 days, and overnight is next business day. Free shipping available on orders over $75. Would you like more shipping information?";
    }
  }
  
  // Check for payments
  if (message.match(/(pay|payment|billing|card|credit|debit|paypal|how.*pay|payment method)/)) {
    const data = getDataFromFile('payments');
    if (data) {
      const answer = getAnswerFromData(userMessage, data);
      if (answer) return answer;
      // Fallback
      return "We accept all major credit cards, debit cards, PayPal, Apple Pay, and Google Pay. All payments are processed securely. Would you like more payment information?";
    }
  }
  
  // Check for orders (improved pattern matching)
  if (message.match(/(order|orders|latest.*order|recent.*order|my order|order history|order status|track.*order|place.*order|view.*order|order id|order ids|all order)/)) {
    const data = getDataFromFile('orders');
    if (data) {
      const answer = getAnswerFromData(userMessage, data);
      if (answer && answer.length > 30) return answer; // Only use if we got a good answer
      
      // Specific responses for common order questions
      if (message.match(/(order id|order ids|all order|get.*order id)/)) {
        return "You can view all your order IDs by logging into your account at www.oursite.com/my-orders. Your order history page shows all past orders with their order numbers. You can also find order IDs in your order confirmation emails.";
      }
      
      if (message.match(/(latest|recent|last|newest).*order/)) {
        return "To view your latest order, log into your account at www.oursite.com/my-orders. You can see all your past orders there, with the most recent orders at the top. You can also check your email for order confirmation messages.";
      }
      
      if (message.match(/(track|tracking|where.*order|order status)/)) {
        return "You can track your order using your order number and email at www.oursite.com/my-orders. You'll also receive email updates at each stage of your order. Login to see real-time tracking information.";
      }
      
      if (message.match(/(cancel|cancellation)/)) {
        return "You can cancel your order within 1 hour of placing it. After that, contact us immediately and we'll try to help if the order hasn't shipped yet.";
      }
      
      // Generic fallback - but more helpful
      return "I can help you with your orders. You can view your order history, track orders, and manage your account at www.oursite.com/my-orders. What specific information do you need about your order?";
    }
  }
  
  // Help requests
  if (message.includes('help')) {
    return "I'd be happy to help! I can assist you with returns, shipping, payments, and orders. What would you like to know about?";
  }
  
  // Thank you
  if (message.match(/(thank|thanks|appreciate)/)) {
    return "You're very welcome! Is there anything else I can help you with today?";
  }
  
  // Goodbye
  if (message.match(/(bye|goodbye|see you|farewell|exit|quit)/)) {
    return "Thank you for contacting us! Have a wonderful day! If you need anything else, feel free to reach out anytime.";
  }
  
  // Note: This function is synchronous, so for warranty questions we'll use the file directly
  // The async getWarrantyKnowledgeBase is used in the main API handler
  if (message.match(/(warranty|warranties|repair|service|guarantee|coverage|register.*product|extended.*warranty|international.*warranty|samsung.*warranty|tablet|smartphone|phone|watch|buds|headphone|charger|battery)/)) {
    const data = getDataFromFile('warranty');
    if (data) {
      const answer = getAnswerFromData(userMessage, data);
      if (answer && answer.length > 10) {
        console.log('Found warranty answer from knowledge base:', answer);
        return answer;
      }
      // Fallback
      return "I can help you with Samsung warranty information. All Samsung products come with a standard manufacturer's warranty. You can register your product online through My Page for faster support. Would you like to know more about warranty periods for specific products or how to book a repair?";
    }
  }
  
  // Default friendly response
  return "I'm a Samsung warranty specialist. I can help you with information about Samsung product warranties, repairs, product registration, and support services. What would you like to know?";
}

/**
 * Legacy mock response function (kept for backward compatibility)
 * Now redirects to improved mock response
 */
function getMockResponse(userMessage) {
  return getImprovedMockResponse(userMessage);
}

/**
 * POST /api/chat
 * 
 * This endpoint receives a user message and returns an AI response
 * 
 * Request body: { message: "user's message here" }
 * Response: { response: "AI's response here" }
 */
app.post('/api/chat', async (req, res) => {
  try {
    // Get the user's message from the request body
    const { message } = req.body;

    // Check if message exists
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let aiResponse;

    // Priority: 1. OpenAI (with warranty knowledge base), 2. Hugging Face (FREE), 3. Mock responses
    console.log('USE_OPENAI:', USE_OPENAI, 'OPENAI_API_KEY exists:', !!OPENAI_API_KEY);
    if (USE_OPENAI) {
      try {
        // Use OpenAI if API key is provided
        console.log('Using OpenAI API for:', message);
        
        // Load warranty knowledge base (from live website or file)
        const warrantyKB = await getWarrantyKnowledgeBase();
        
        // Create system prompt with warranty knowledge base
        let systemPrompt = `You are a Samsung warranty specialist customer service representative. Your ONLY job is to answer questions using the EXACT information from the Samsung warranty knowledge base provided below.

CRITICAL INSTRUCTIONS:
1. ALWAYS look up the answer in the knowledge base first - DO NOT make up or guess information
2. For warranty period questions, find the product in the knowledge base and state the EXACT warranty period (e.g., "24 Months", "12 Months", "6 Months")
3. Use the EXACT wording and format from the knowledge base when possible
4. Be direct and specific - don't give generic responses when you have specific information
5. If asked about a product warranty period, respond with: "Warranty period: [X] Months" where X is the exact number from the knowledge base
6. Include relevant additional information from the knowledge base (repair services, etc.) when helpful

Example responses:
- Question: "What is tablet warranty period?" 
  Answer: "Warranty period: 24 Months. Our Samsung Authorised Service Partners offer both In and Out of warranty repairs. Repair services available: In-store repair, Pick up repair, Doorstep repair."

- Question: "How long is smartphone warranty?"
  Answer: "Warranty period: 24 Months. Our Samsung Authorised Service Partners offer both In and Out of warranty repairs. Repair services available: In-store repair, Pick up repair, Doorstep repair."

DO NOT give generic responses like "I can help you with warranty information" when you have the specific answer in the knowledge base. ALWAYS provide the exact warranty period and relevant details.`;

        // Add warranty knowledge base to system prompt
        if (warrantyKB) {
          systemPrompt += `\n\n=== SAMSUNG WARRANTY KNOWLEDGE BASE (USE THIS TO ANSWER ALL QUESTIONS) ===\n${warrantyKB}\n\n=== END OF KNOWLEDGE BASE ===\n\nRemember: Use the EXACT information from the knowledge base above. For warranty period questions, find the product section and state the exact warranty period.`;
        } else {
          systemPrompt += `\n\nNote: The warranty knowledge base is currently unavailable. Provide general helpful responses and guide customers to contact Samsung support for specific warranty information.`;
        }
        
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 500,
          temperature: 0.3
        });
        aiResponse = completion.choices[0].message.content;
      } catch (openaiError) {
        // If OpenAI fails, log the error and fall back
        console.error('OpenAI API error:', openaiError.message);
        console.log('Falling back to warranty knowledge base extraction...');
        // Try to use warranty knowledge base directly for warranty questions
        const messageLower = message.toLowerCase();
        if (messageLower.match(/(warranty|warranties|tablet|smartphone|phone|watch|buds|headphone|charger|battery|s pen|strap)/)) {
          try {
            const warrantyKB = await getWarrantyKnowledgeBase();
            if (warrantyKB) {
              const answer = getAnswerFromData(message, warrantyKB);
              if (answer) {
                aiResponse = answer;
              } else {
                aiResponse = getImprovedMockResponse(message);
              }
            } else {
              aiResponse = getImprovedMockResponse(message);
            }
          } catch (kbError) {
            console.error('Error getting warranty KB in fallback:', kbError);
            aiResponse = getImprovedMockResponse(message);
          }
        } else {
          aiResponse = getImprovedMockResponse(message);
        }
      }
    } else if (USE_HUGGING_FACE) {
      // Use Hugging Face FREE API (no payment needed!)
      console.log('Using Hugging Face FREE API for:', message);
      aiResponse = await getHuggingFaceResponse(message);
      // Note: getHuggingFaceResponse will fallback to improved mock if API fails
    } else {
      // Fallback to improved mock responses
      console.log('Using improved mock response for:', message);
      await new Promise(resolve => setTimeout(resolve, 300));
      aiResponse = getImprovedMockResponse(message);
    }

    // Send the response back to the frontend
    res.json({ response: aiResponse });

  } catch (error) {
    // Handle errors gracefully
    console.error('Error in /api/chat:', error);
    
    // Try to provide a helpful response even on error
    try {
      const warrantyKB = await getWarrantyKnowledgeBase();
      const messageLower = message.toLowerCase();
      if (warrantyKB && messageLower.match(/(warranty|warranties|tablet|smartphone|phone|watch|buds)/)) {
        const answer = getAnswerFromData(message, warrantyKB);
        if (answer) {
          return res.json({ response: answer });
        }
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
    
    // Send error message to frontend
    res.status(500).json({ 
      error: 'Failed to get response from AI',
      details: error.message 
    });
  }
});

/**
 * Health check endpoint
 * Useful to verify the server is running
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running!' });
});

/**
 * Clear warranty cache endpoint
 * Useful for forcing a refresh of warranty data from website
 */
app.post('/api/clear-cache', (req, res) => {
  try {
    clearWarrantyCache();
    res.json({ status: 'Cache cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache', details: error.message });
  }
});

/**
 * Get warranty data endpoint (for testing)
 */
app.get('/api/warranty-data', async (req, res) => {
  try {
    const warrantyData = await getWarrantyKnowledgeBase();
    res.json({ 
      status: 'success',
      source: warrantyData ? 'live' : 'file',
      data: warrantyData ? warrantyData.substring(0, 500) + '...' : 'No data available'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get warranty data', details: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  if (USE_OPENAI) {
    console.log(`✅ Using OpenAI API with Samsung Warranty Knowledge Base`);
    const warrantyKB = getWarrantyKnowledgeBase();
    if (warrantyKB) {
      console.log(`📚 Warranty knowledge base loaded successfully`);
    } else {
      console.log(`⚠️  Warning: Warranty knowledge base not found`);
    }
  } else if (USE_HUGGING_FACE) {
    console.log(`🆓 Using Hugging Face FREE API (no payment needed!)`);
    console.log(`💡 Optional: Add HUGGING_FACE_API_KEY to .env for better rate limits`);
  } else {
    console.log(`⚠️  Running in MOCK MODE`);
  }
});

