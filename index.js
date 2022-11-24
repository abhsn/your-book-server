const express = require('express');
const cors = require('cors');

const port = process.send.PORT || 5000;

// initialize express
const app = express();

// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
	res.send('Resale market is running...');
});

app.listen(port, () => console.log('Listening to port', port));