'use strict';

require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SD-OutfitHub server is running at http://localhost:${PORT}`);
});
