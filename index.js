const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const port = process.send.PORT || 5000;

// initialize express
const app = express();

// initialize dotenv
require('dotenv').config();

// middleware
app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
	res.send('Resale market is running...');
});

const uri = process.env.DB_URL;
const client = new MongoClient(uri);

async function crudOperation() {
	try {
		const categoriesCollection = client.db("resale-market").collection('categories');
		app.get('/categories', async (req, res) => {
			const query = {};
			const cursor = categoriesCollection.find(query);
			const categories = await cursor.toArray();
			res.send(categories);
		})
	}
	catch (err) {
		console.log(err);
	}
}

crudOperation();

app.listen(port, () => console.log('Listening to port', port));