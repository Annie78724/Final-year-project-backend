const express = require("express");
const app = express();
const cors = require("cors");
const pool = require("./db");

//middleware
app.use(cors());
app.use(express.json());
app.use(express.json({limit : '50mb',extended : true}))
app.use(express.urlencoded({limit : '50mb',extended : true}))

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Connected to PostgreSQL database');
  release(); // Release the client back to the pool
});

async function createTables() {
  const client = await pool.connect();
  try {
      await client.query(`
      CREATE TABLE IF NOT EXISTS Author (
        author_id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        website VARCHAR(255),
        affiliations TEXT,
        thumbnail VARCHAR(255),
        interests JSON -- Assuming interests will be stored as a JSON string
    );

          CREATE TABLE IF NOT EXISTS Articles (
              citation_id VARCHAR(255) PRIMARY KEY, 
              author_id VARCHAR(255),
              title VARCHAR(255),
              authors VARCHAR(255),
              publications VARCHAR(255),
              cited_by_value VARCHAR(255),
              cites_id VARCHAR(255),
              year VARCHAR(255),
              FOREIGN KEY (author_id) REFERENCES Author(author_id)
          );

          CREATE TABLE IF NOT EXISTS CoAuthors (
              coauthor_unique_id VARCHAR(255) PRIMARY KEY,
              coauthor_id VARCHAR(255),
              author_id VARCHAR(255),
              name VARCHAR(255),
              affiliations TEXT,
              email VARCHAR(255),
              thumbnail VARCHAR(255),
              FOREIGN KEY (author_id) REFERENCES Author(author_id)
          );


          CREATE TABLE IF NOT EXISTS CITED_BY (
              cited_by_unique_id VARCHAR(255) PRIMARY KEY,
              author_id VARCHAR(255),
              cites_id VARCHAR(255),
              result_id VARCHAR(255),
              title VARCHAR(255),
              publication_author_name VARCHAR(255),
              publication_author_id VARCHAR(255)
          );
      `);
      console.log('Tables created if they did not exist already');
  } catch (err) {
      console.error('Error creating tables:', err);
  } finally {
      client.release();
  }
}

createTables();

app.post("/api/insertdata", async (req, res) => {
  const data = req.body; // Assuming the JSON object contains data for all tables
  console.log(data);
  const id = data.search_parameters.author_id;
  console.log(id);
  try {
    // Check if the author with the given id already exists in the Author table
    const authorExistQuery = "SELECT COUNT(*) FROM Author WHERE author_id = $1";
    const authorExistValues = [id];
    const authorExistResult = await pool.query(authorExistQuery, authorExistValues);
    const authorExistCount = authorExistResult.rows[0].count;

    if (authorExistCount > 0) {
      // If author already exists, return "already exists"
        // Insert data into the Articles table
    const articlesQuery =
    "INSERT INTO Articles (citation_id, author_id, title, authors, publications, cited_by_value, cites_id, year) VALUES ($1, $2, $3, $4, $5, $6 , $7, $8 ) RETURNING *";
  for (const article of data.articles) {
    const articlesValues = [
      article.citation_id,
      id,
      article.title,
      article.authors,
      article.publication,
      article.cited_by.value,
      article.cited_by.cites_id,
      article.year,
    ];
    await pool.query(articlesQuery, articlesValues);
  }
  res.status(201).send("Data inserted successfully articles tables.");
      return;
    }

    // Insert data into the Author table
    let interests = [];
    data.author.interests.forEach((interest) => {
      interests.push(interest.title);
    });
    // Convert interests array to a JSON string
    const interestsJSON = JSON.stringify(interests);

    const authorQuery =
      "INSERT INTO Author (author_id, name, email, website, affiliations, thumbnail, interests) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *";
    const authorValues = [
      id,
      data.author.name,
      data.author.email,
      data.author.website,
      data.author.affiliations,
      data.author.thumbnail,
      interestsJSON, // Pass the JSON string representation of interests
    ];

    await pool.query(authorQuery, authorValues);

    // Insert data into the Articles table
    const articlesQuery =
      "INSERT INTO Articles (citation_id, author_id, title, authors, publications, cited_by_value, cites_id, year) VALUES ($1, $2, $3, $4, $5, $6 , $7, $8 ) RETURNING *";
    for (const article of data.articles) {
      const articlesValues = [
        article.citation_id,
        id,
        article.title,
        article.authors,
        article.publication,
        article.cited_by.value,
        article.cited_by.cites_id,
        article.year,
      ];
      await pool.query(articlesQuery, articlesValues);
    }

    // Insert data into the CoAuthors table
    const coAuthorsQuery =
      "INSERT INTO CoAuthors (coauthor_unique_id, coauthor_id, author_id, name, affiliations, email, thumbnail) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *";
    for (const coAuthor of data.co_authors) {
      const coauthor_unique_string = id + "#" + coAuthor.author_id;
      const coAuthorsValues = [
        coauthor_unique_string,
        coAuthor.author_id,
        id,
        coAuthor.name,
        coAuthor.affiliations,
        coAuthor.email,
        coAuthor.thumbnail,
      ];
      await pool.query(coAuthorsQuery, coAuthorsValues);
    }

    res.status(201).send("Data inserted successfully into all tables.");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error inserting data.");
  }
});

app.post("/api/insert-cited-by-information", async (req, res) => {
  try {
    const {author_id,cited_by_info}=req.body;
    console.log(author_id,cited_by_info.search_metadata.id);
    let cites_id=cited_by_info.search_parameters.cites;   
    for(const organic_result of cited_by_info.organic_results)
    {
      let title=organic_result.title,result_id=organic_result.result_id;
      if(organic_result.publication_info.authors==null)
      {
        let publication_author_name="NULL",publication_author_id="NULL";
        const citedByQuery="INSERT INTO CITED_BY (cited_by_unique_id,author_id, cites_id, result_id, title, publication_author_name, publication_author_id) VALUES ($1, $2, $3, $4, $5, $6, $7)";
        let cited_by_unique_id=author_id+"#"+cites_id+"#"+result_id+"#"+publication_author_id;
        console.log(cited_by_unique_id,publication_author_id); 
        let citedByValues=[cited_by_unique_id,author_id, cites_id, result_id, title, publication_author_name, publication_author_id]
        await pool.query(citedByQuery,citedByValues);
      }
      else
      {
        for(const author of organic_result.publication_info.authors)
        {
          let publication_author_name=author.name,publication_author_id=author.author_id;
          const citedByQuery="INSERT INTO CITED_BY (cited_by_unique_id,author_id, cites_id, result_id, title, publication_author_name, publication_author_id) VALUES ($1, $2, $3, $4, $5, $6, $7)";
          let cited_by_unique_id=author_id+"#"+cites_id+"#"+result_id+"#"+publication_author_id;
          console.log(cited_by_unique_id,publication_author_id);
          let citedByValues=[cited_by_unique_id,author_id, cites_id, result_id, title, publication_author_name, publication_author_id]
          await pool.query(citedByQuery,citedByValues);
        }
      }
    }
    res.status(200).send("Query successful");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

//get Authors
app.post("/authors", async (req, res) => {
  try {
    const getAuthors = await pool.query("SELECT * FROM author WHERE LOWER(name) LIKE LOWER($1);",["%"+req.body.name+"%"]);
    console.log(getAuthors.rows);
    res.json(getAuthors.rows);
  } catch (error) {
    console.error(error.message);
  }
});

//get all data

app.post("/get-all-data", async (req, res) => {
  try {
    const getAllData = await pool.query("SELECT A.author_id, A.name AS author_name, A.email, A.website, A.affiliations AS author_affiliations, A.thumbnail AS author_thumbnail, A.interests AS author_interests, (SELECT json_agg(json_build_object('citation_id', AR.citation_id, 'cites_id', AR.cites_id, 'title', AR.title, 'authors', AR.authors, 'year', AR.year, 'publications', AR.publications, 'cited_by_value', AR.cited_by_value)) FROM Articles AR WHERE AR.author_id = A.author_id) AS articles, (SELECT json_agg(json_build_object('name', CA.name, 'affiliations', CA.affiliations, 'thumbnail', CA.thumbnail)) FROM CoAuthors CA WHERE CA.author_id = A.author_id) AS coauthors FROM Author A WHERE A.author_id = $1",[req.body.id]);
    console.log(getAllData.rows);
    res.json(getAllData.rows);
  } catch (error) {
    console.error(error.message);
  }
});

app.post("/api/get-cited-by-information", async (req, res) => {
  try {
    const { author_id, cites_id } = req.body; // Extract author_id and cites_id from req.body

    // Fetch data from the CITED_BY table matching the provided author_id and cites_id
    const queryResult = await pool.query(
      "SELECT * FROM CITED_BY WHERE author_id = $1 AND cites_id = $2",
      [author_id, cites_id]
    );

    // Prepare the response object
    const citedByInformation = {
      search_parameters: {
        author_id,
        cites_id
      },
      organic_results: []
    };

    // Loop through the query result and populate organic_results array
    queryResult.rows.forEach(row => {
      const {
        cited_by_unique_id,
        author_id,
        cites_id,
        result_id,
        title,
        publication_author_name,
        publication_author_id
      } = row;

      // Extract publication info
      const publication_info = {
        authors: [{
          name: publication_author_name,
          author_id: publication_author_id
        }]
      };

      // Construct organic_result object
      const organic_result = {
        result_id,
        title,
        publication_info
      };

      // Add organic_result to organic_results array
      citedByInformation.organic_results.push(organic_result);
    });

    // Send the response
    res.status(200).json(citedByInformation);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/get-self-citation",async (req,res)=>{
  const {id}=req.body;
  const getAllData = await pool.query("SELECT A.author_id, A.name AS author_name, A.email, A.website, A.affiliations AS author_affiliations, A.thumbnail AS author_thumbnail, A.interests AS author_interests, (SELECT json_agg(json_build_object('citation_id', AR.citation_id, 'cites_id', AR.cites_id, 'title', AR.title, 'authors', AR.authors, 'year', AR.year, 'publications', AR.publications, 'cited_by_value', AR.cited_by_value)) FROM Articles AR WHERE AR.author_id = A.author_id) AS articles, (SELECT json_agg(json_build_object('name', CA.name, 'affiliations', CA.affiliations, 'thumbnail', CA.thumbnail)) FROM CoAuthors CA WHERE CA.author_id = A.author_id) AS coauthors FROM Author A WHERE A.author_id = $1",[id]);
  const articles=getAllData.rows[0].articles;
  console.log(articles);
  var result_id_array=[];
  for(const article of articles)
  {
    if(article.cites_id!==null)
    {
      const author_id=id;
      const cites_id=article.cites_id;
      const citedByQuery = await pool.query(
        "SELECT * FROM CITED_BY WHERE author_id = $1 AND cites_id = $2",
        [author_id, cites_id]
      );
      for(const citedBy of citedByQuery.rows)
      {
        if(citedBy.publication_author_id==author_id)
        {
          const obj={
            result_id:citedBy.result_id,
            cites_id:article.cites_id
          }
          result_id_array.push(obj);
        }
      }
    }
  }
  res.json(result_id_array);
})

// app.get("/del",async (req,res)=>{
//   const query =await pool.query("delete from cited_by");
//   console.log("deleted");
// })
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});