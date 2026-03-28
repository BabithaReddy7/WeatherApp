const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// CHANGE: Updated function to use WeatherAPI.com
async function fetchWeatherForCity(city) {
  try {
    // CHANGE: Using the new environment variable and API endpoint
    const apiKey = process.env.WEATHER_API_KEY;
    const response = await axios.get(
      `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city}`
    );
    return response.data;
  } catch (error) {
    // This error handling will now catch errors like "Invalid API key" or "No matching location found."
    console.error(`Error fetching weather for ${city}:`, error.response ? error.response.data.error.message : error.message);
    throw error;
  }
}

// This function remains the same
function generateWeatherApology(customer, city, weatherCondition) {
  const conditionMessages = {
    'Rain': 'heavy rain',
    'Snow': 'snow',
    'Extreme': 'extreme weather conditions' // Note: WeatherAPI uses "Blizzard", "Thunder", etc.
  };
  
  // We'll use a more generic message if the condition isn't in our list
  const condition = conditionMessages[weatherCondition] || 'adverse weather';
  return `Hi ${customer}, your order to ${city} is delayed due to ${condition}. We appreciate your patience!`;
}

// CHANGE: Updated function to parse WeatherAPI.com's response
function shouldDelayOrder(weatherData) {
  // WeatherAPI.com puts the main condition in `current.condition.text`
  const conditionText = weatherData.current.condition.text;
  
  // We check if the text includes words like Rain, Snow, or other severe conditions
  const delayKeywords = ['Rain', 'Snow', 'Blizzard', 'Thunder', 'Extreme', 'Hail'];
  return delayKeywords.some(keyword => conditionText.includes(keyword));
}

// Main function to process all orders (no changes needed here)
async function processOrders() {
  try {
    const ordersPath = path.join(__dirname, 'orders.json');
    const ordersData = await fs.readFile(ordersPath, 'utf8');
    const orders = JSON.parse(ordersData);
    
    const weatherPromises = orders.map(async (order) => {
      try {
        const weatherData = await fetchWeatherForCity(order.city);
        return {
          order,
          weatherData,
          success: true
        };
      } catch (error) {
        console.error(`Failed to fetch weather for order ${order.order_id}:`, error.message);
        return {
          order,
          error: error.message,
          success: false
        };
      }
    });
    
    const weatherResults = await Promise.all(weatherPromises);
    
    const updatedOrders = weatherResults.map(result => {
      if (result.success) {
        const { order, weatherData } = result;
        
        if (shouldDelayOrder(weatherData)) {
          // CHANGE: Get the condition text from the new path
          const weatherCondition = weatherData.current.condition.text;
          const apologyMessage = generateWeatherApology(
            order.customer, 
            order.city, 
            weatherCondition
          );
          
          console.log(apologyMessage);
          
          return {
            ...order,
            status: 'Delayed',
            weatherCondition,
            apologyMessage
          };
        }
        
        return {
          ...order,
          // CHANGE: Get the condition text from the new path
          weatherCondition: weatherData.current.condition.text
        };
      } else {
        return {
          ...result.order,
          status: 'Error',
          error: result.error
        };
      }
    });
    
    await fs.writeFile(ordersPath, JSON.stringify(updatedOrders, null, 2));
    console.log('Orders updated successfully');
    
    return updatedOrders;
  } catch (error) {
    console.error('Error processing orders:', error);
    throw error;
  }
}

// Run the main function (no changes needed here)
processOrders()
  .then(orders => {
    console.log('Processing complete');
  })
  .catch(error => {
    console.error('Script failed:', error);
  });