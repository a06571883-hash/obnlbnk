const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/; 
const addresses = [
  '1hMe3U2Vnbk4frpqQwN3hgF9uwEoE1', 
  '1M2CiY8ibFcmK6u5eQXy5WH75daH5p', 
  '1c4uWDbzSB3szHnC5FNaTHXKZh1dNg', 
  '1YssBN3hJ3nLJzXMa732MKWKRpc9DF', 
  '19JF5H5tyfsQ1f2ZYZs7mn8fqbuDsM'
]; 

addresses.forEach(addr => {
  console.log(`${addr} - ${legacyRegex.test(addr) ? 'valid' : 'invalid'}`);
});
