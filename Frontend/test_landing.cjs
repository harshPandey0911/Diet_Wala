const http = require('http');

http.get('http://localhost:5000/api/v1/food/landing/settings/public', {
  headers: { 'Content-Type': 'application/json' }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const rm = data.data.allRawRestaurants.find(r => r.name === 'The Royal Maratha');
      if (rm) {
        console.log("RM Payload:", JSON.stringify(rm, null, 2));
      } else {
        console.log("RM not found!");
      }
    } catch(e) { console.log(e); }
  });
});
