
//rtesting connection to virtual touter [run: node test.api.js]
const { RouterOSAPI } = require('node-routeros');

const connection = new RouterOSAPI({
  host: '192.168.88.1',
  user: 'admin', 
  password: 'marshalsql', 
});

(async () => {
  try {
    await connection.connect();
    const response = await connection.write('/system/resource/print');
    console.log('Connected to router...,', response[0].platform );
    
    
    console.log(response);
    
    await connection.close();
  } catch (error) {
    console.error('Connection failed:', error);
  }
})();
