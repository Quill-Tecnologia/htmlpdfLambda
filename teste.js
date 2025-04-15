const request = require('request-promise');

request({
    url: 'https://geo.brdtest.com/welcome.txt?product=dc&method=native',
    proxy: 'http://brd-customer-hl_1526f663-zone-data_center:nja9754nl2ze@brd.superproxy.io:33335',
}).then(
    function(data){ console.log(data); },
    function(err){ console.error(err); },
);