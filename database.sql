

CREATE TABLE Articles (
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

CREATE TABLE CoAuthors (
    coauthor_unique_id VARCHAR(255) PRIMARY KEY,
    coauthor_id VARCHAR(255),
    author_id VARCHAR(255),
    name VARCHAR(255),
    affiliations TEXT,
    email VARCHAR(255),
    thumbnail VARCHAR(255),
    FOREIGN KEY (author_id) REFERENCES Author(author_id)
);

CREATE TABLE Author (
    author_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    website VARCHAR(255),
    affiliations TEXT,
    thumbnail VARCHAR(255),
    interests JSON -- Assuming interests will be stored as a JSON string
);

CREATE TABLE CITED_BY (
    -- cites_id#result_id#publication_author_id
    cited_by_unique_id VARCHAR(255) PRIMARY KEY,
    author_id VARCHAR(255),
    cites_id VARCHAR(255),
    result_id VARCHAR(255),
    title VARCHAR(255),
    publication_author_name VARCHAR(255),
    publication_author_id VARCHAR(255)
);

