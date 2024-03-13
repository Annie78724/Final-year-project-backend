const express = require("express");
const app = express();
const cors = require("cors");
const pool = require("./db");

//middleware
app.use(cors());
app.use(express.json());


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
    const getAuthorId = await pool.query("SELECT author_id FROM articles WHERE cites_id = $1", [req.body.search_parameters.cites]);
    let author_id=getAuthorId.rows[0].author_id;
    let cites_id=req.body.search_parameters.cites;   
    for(const organic_result of req.body.organic_results)
    {
      let title=organic_result.title,result_id=organic_result.result_id;
      if(organic_result.publication_info.authors==null)
      {
        let publication_author_name="NULL",publication_author_id="NULL";
        const citedByQuery="INSERT INTO CITED_BY (cited_by_unique_id,author_id, cites_id, result_id, title, publication_author_name, publication_author_id) VALUES ($1, $2, $3, $4, $5, $6, $7)";
        let cited_by_unique_id=cites_id+"#"+result_id+"#"+publication_author_id;
        let citedByValues=[cited_by_unique_id,author_id, cites_id, result_id, title, publication_author_name, publication_author_id]
        await pool.query(citedByQuery,citedByValues);
      }
      else
      {
        for(const author of organic_result.publication_info.authors)
        {
          let publication_author_name=author.name,publication_author_id=author.author_id;
          const citedByQuery="INSERT INTO CITED_BY (cited_by_unique_id,author_id, cites_id, result_id, title, publication_author_name, publication_author_id) VALUES ($1, $2, $3, $4, $5, $6, $7)";
          let cited_by_unique_id=cites_id+"#"+result_id+"#"+publication_author_id;
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
app.get("/authors", async (req, res) => {
  try {
    const getAuthors = await pool.query("SELECT * FROM author WHERE LOWER(name) LIKE LOWER($1);",["%"+req.body.name+"%"]);
    console.log(getAuthors.rows);
    res.json(getAuthors.rows);
  } catch (error) {
    console.error(error.message);
  }
});

//get all data

app.get("/get-all-data", async (req, res) => {
  try {
    const getCoAuthors = await pool.query("SELECT A.author_id, A.name AS author_name, A.email, A.website, A.affiliations AS author_affiliations, A.thumbnail AS author_thumbnail, A.interests AS author_interests, (SELECT json_agg(json_build_object('citation_id', AR.citation_id, 'cites_id', AR.cites_id, 'title', AR.title, 'authors', AR.authors, 'year', AR.year, 'publications', AR.publications, 'cited_by_value', AR.cited_by_value)) FROM Articles AR WHERE AR.author_id = A.author_id) AS articles, (SELECT json_agg(json_build_object('name', CA.name, 'affiliations', CA.affiliations, 'thumbnail', CA.thumbnail)) FROM CoAuthors CA WHERE CA.author_id = A.author_id) AS coauthors FROM Author A WHERE A.author_id = $1",[req.body.id]);
    console.log(getCoAuthors.rows);
    res.json(getCoAuthors.rows);
  } catch (error) {
    console.error(error.message);
  }
});

app.get("/api/get-cited-by-information", async (req, res) => {
  try {
    const { author_id, result_id } = req.body; // Extract author_id and result_id from req.body

    // Fetch data from the CITED_BY table matching the provided author_id and result_id
    const queryResult = await pool.query(
      "SELECT * FROM CITED_BY WHERE author_id = $1 AND result_id = $2",
      [author_id, result_id]
    );

    // Prepare the response object
    const citedByInformation = {
      search_parameters: {
        author_id,
        result_id
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

app.listen(5000, (req, res) => {
  console.log("Server is listening to port 5000");
});
