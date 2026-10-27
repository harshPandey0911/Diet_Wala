const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/food/restaurant/restaurants?limit=100',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'X-Zone-Id': '666299b828a2a5370d9a6c6a' // Using a dummy zone ID that is 24 chars hex
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('Total restaurants:', data.data?.restaurants?.length);
      const rm = data.data?.restaurants?.find(r => r.name === 'The Royal Maratha' || r.name === 'Sarafa Street Bites');
      if (rm) {
        console.log("RM Payload:", JSON.stringify(rm, null, 2));
      } else {
        console.log("RM not found!");
      }
    } catch(e) { console.log('Parse error:', e.message, body.substring(0,100)); }
  });
});

req.on('error', e => console.error(e));
req.end();
