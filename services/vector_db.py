# services/vector_db.py
from langchain_community.vectorstores import Neo4jVector
from neo4j import GraphDatabase

from config import get_embeddings, get_neo4j_config
from utils.logger import get_logger

logger = get_logger(__name__)


class Neo4jService:
    def __init__(self):
        config = get_neo4j_config()
        self.driver = GraphDatabase.driver(
            config["uri"],
            auth=(config["username"], config["password"]),
        )
        self.embeddings = get_embeddings()
        self.vectorstore = None

    def initialize_vector_index(self):
        """Create vector index if it doesn't exist"""
        try:
            with self.driver.session() as session:
                session.run(
                    """
                    CREATE CONSTRAINT IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE
                    """
                )
                session.run(
                    """
                    CREATE VECTOR INDEX document_chunks IF NOT EXISTS
                    FOR (c:Chunk) ON (c.embedding)
                    OPTIONS {indexConfig: {
                        `vector.dimensions`: 384,
                        `vector.similarity_function`: 'cosine'
                    }}
                    """
                )
                session.run("CALL db.awaitIndex('document_chunks', 300)")

            config = get_neo4j_config()
            self.vectorstore = Neo4jVector.from_existing_index(
                embedding=self.embeddings,
                url=config["uri"],
                username=config["username"],
                password=config["password"],
                database=config.get("database", "neo4j"),
                index_name="document_chunks",
                node_label="Chunk",
                embedding_node_property="embedding",
                text_node_property="text",
            )

            logger.info("Neo4j vector index initialized")
        except Exception as exc:
            logger.error(f"Neo4j initialization failed: {exc}")
            raise

    def store_documents(self, filename: str, chunks: list, user_id: str = "default"):
        """Store document chunks in Neo4j with embeddings and per-user metadata."""
        try:
            config = get_neo4j_config()

            for index, chunk in enumerate(chunks):
                embedding_vector = self.embeddings.embed_query(chunk.page_content)
                chunk.metadata["embedding"] = embedding_vector
                chunk.metadata["id"] = f"{user_id}:{filename}_{index}"
                chunk.metadata["source"] = filename
                chunk.metadata["chunk_index"] = index
                chunk.metadata["user_id"] = user_id

            Neo4jVector.from_documents(
                documents=chunks,
                embedding=self.embeddings,
                url=config["uri"],
                username=config["username"],
                password=config["password"],
                database=config.get("database", "neo4j"),
                index_name="document_chunks",
                node_label="Chunk",
                embedding_node_property="embedding",
                text_node_property="text",
            )

            logger.info(f"Stored {len(chunks)} chunks for {filename}")
            return True
        except Exception as exc:
            logger.error(f"Failed to store documents: {exc}")
            return False

    def search_chunks(self, query: str, k: int = 3) -> list:
        """Search for relevant chunks across indexed content."""
        try:
            if not self.vectorstore:
                self.initialize_vector_index()

            results = self.vectorstore.similarity_search(query, k=k)
            return [
                {
                    "content": doc.page_content,
                    "source": doc.metadata.get("source", "unknown"),
                    "score": 0.8,
                    "chunk_id": doc.metadata.get("id", ""),
                }
                for doc in results
            ]
        except Exception as exc:
            logger.error(f"Search failed: {exc}")
            return []

    def get_document_list(self, user_id: str = "default") -> list:
        """Get uploaded document list for one user."""
        try:
            with self.driver.session() as session:
                result = session.run(
                    """
                    MATCH (c:Chunk)
                    WHERE c.user_id = $user_id
                    RETURN c.source as filename,
                           count(c) as chunks,
                           null as uploaded_at
                    ORDER BY filename ASC
                    """,
                    user_id=user_id,
                )
                return [dict(record) for record in result]
        except Exception as exc:
            logger.error(f"Failed to get documents: {exc}")
            return []

    def close(self):
        if self.driver:
            self.driver.close()


neo4j_service = Neo4jService()
