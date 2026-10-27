const http = require('http');

http.get('http://localhost:5000/api/v1/food/public/landing', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const restaurants = json.data.allRawRestaurants || [];
    restaurants.forEach(r => {
      console.log(`${r.name}: isActive=${r.isActive}, isAcceptingOrders=${r.isAcceptingOrders}`);
      console.log(`  openingTime=${r.openingTime}, closingTime=${r.closingTime}`);
      if (r.outletTimings && r.outletTimings.timings) {
         console.log(`  outletTimings:`, JSON.stringify(r.outletTimings.timings));
      }
      if (r.deliveryTimings) {
         console.log(`  deliveryTimings:`, JSON.stringify(r.deliveryTimings));
      }
    });
  });
});
