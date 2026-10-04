"use client";

import {
  ArrowLeft,
  CheckCircle2,
  FileJson,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import styles from "./DocumentLibrary.module.css";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const ACCEPTED_TYPES = [
  ".txt",
  ".md",
  ".csv",
  ".json",
];

const ACCEPTED_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

function isSupportedFile(file) {
  const name =
    file?.name?.toLowerCase() || "";

  return (
    ACCEPTED_MIME_TYPES.has(file?.type) ||
    ACCEPTED_TYPES.some((extension) =>
      name.endsWith(extension),
    )
  );
}

function formatBytes(bytes) {
  const value =
    Number(bytes) || 0;

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function fileIcon(document) {
  const mime =
    document?.mime || "";

  if (
    mime ===
    "application/json"
  ) {
    return FileJson;
  }

  return FileText;
}

function friendlyError(response, fallback) {
  return response
    .json()
    .then((data) =>
      typeof data?.error === "string"
        ? data.error
        : fallback,
    )
    .catch(() => fallback);
}

export default function DocumentLibrary({
  initialUser,
}) {
  const inputRef = useRef(null);

  const [documents, setDocuments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState(null);

  const [searching, setSearching] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const [results, setResults] =
    useState(null);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  async function loadDocuments() {
    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/documents",
          {
            method: "GET",
            cache: "no-store",
          },
        );

      if (!response.ok) {
        throw new Error(
          await friendlyError(
            response,
            "Could not load your documents.",
          ),
        );
      }

      const data =
        await response.json();

      setDocuments(
        Array.isArray(data?.documents)
          ? data.documents
          : [],
      );
    } catch (loadError) {
      console.error(
        "OZLIND document load failed:",
        loadError,
      );

      setError(
        loadError?.message ||
          "Could not load your documents.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer =
      window.setTimeout(
        () => setNotice(""),
        3000,
      );

    return () =>
      window.clearTimeout(timer);
  }, [notice]);

  async function uploadFile(file) {
    if (!file) {
      return;
    }

    if (!isSupportedFile(file)) {
      setError(
        "Only .txt, .md, .csv and .json files are supported.",
      );
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setError(
        "Documents must be smaller than 2 MB.",
      );
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");

    try {
      const content =
        await file.text();

      if (!content.trim()) {
        throw new Error(
          "This document is empty.",
        );
      }

      const response =
        await fetch(
          "/api/documents",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name: file.name,
              mime:
                file.type ||
                "text/plain",
              sizeBytes:
                file.size,
              content,
            }),
          },
        );

      if (!response.ok) {
        throw new Error(
          await friendlyError(
            response,
            "Could not process this document.",
          ),
        );
      }

      const data =
        await response.json();

      const document =
        data?.document;

      if (document) {
        setDocuments(
          (current) => [
            document,
            ...current.filter(
              (item) =>
                item.id !==
                document.id,
            ),
          ],
        );
      } else {
        await loadDocuments();
      }

      setNotice(
        `${file.name} is ready for OZLIND.`,
      );
    } catch (uploadError) {
      console.error(
        "OZLIND document upload failed:",
        uploadError,
      );

      setError(
        uploadError?.message ||
          "Could not process this document.",
      );
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(event) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (file) {
      uploadFile(file);
    }
  }

  function openFilePicker() {
    if (uploading) {
      return;
    }

    inputRef.current?.click();
  }

  async function deleteDocument(
    document,
  ) {
    if (!document?.id) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${document.name}" from your OZLIND document library?`,
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      document.id,
    );
    setError("");

    try {
      const response =
        await fetch(
          `/api/documents?id=${encodeURIComponent(
            document.id,
          )}`,
          {
            method: "DELETE",
          },
        );

      if (!response.ok) {
        throw new Error(
          await friendlyError(
            response,
            "Could not delete this document.",
          ),
        );
      }

      setDocuments(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              document.id,
          ),
      );

      if (Array.isArray(results)) {
        setResults(
          results.filter(
            (item) =>
              item.document_id !==
              document.id,
          ),
        );
      }

      setNotice(
        `${document.name} deleted.`,
      );
    } catch (deleteError) {
      console.error(
        "OZLIND document delete failed:",
        deleteError,
      );

      setError(
        deleteError?.message ||
          "Could not delete this document.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function searchDocuments(event) {
    event?.preventDefault();

    const value =
      query.trim();

    if (!value) {
      setResults(null);
      return;
    }

    setSearching(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/documents?q=${encodeURIComponent(
            value,
          )}&limit=8`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

      if (!response.ok) {
        throw new Error(
          await friendlyError(
            response,
            "Document search failed.",
          ),
        );
      }

      const data =
        await response.json();

      setResults(
        Array.isArray(data?.results)
          ? data.results
          : [],
      );
    } catch (searchError) {
      console.error(
        "OZLIND document search failed:",
        searchError,
      );

      setError(
        searchError?.message ||
          "Document search failed.",
      );
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setResults(null);
    setError("");
  }

  function goBack() {
    window.location.assign("/");
  }

  const userInitial =
    initialUser?.name
      ?.trim()
      ?.charAt(0)
      ?.toUpperCase() ||
    "O";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.backButton}
            onClick={goBack}
            aria-label="Back to OZLIND AI"
          >
            <ArrowLeft
              size={18}
            />
          </button>

          <div
            className={
              styles.brand
            }
          >
            <strong>
              OZLIND
            </strong>
            <span>
              Documents
            </span>
          </div>
        </div>

        <div
          className={
            styles.userBadge
          }
          title={
            initialUser?.email ||
            "OZLIND account"
          }
        >
          <span>
            {userInitial}
          </span>
        </div>
      </header>

      <section
        className={styles.content}
      >
        <div
          className={
            styles.headingRow
          }
        >
          <div>
            <p
              className={
                styles.eyebrow
              }
            >
              PRIVATE WORKSPACE
            </p>

            <h1>
              Your documents
            </h1>

            <p
              className={
                styles.subtitle
              }
            >
              Add text documents that
              OZLIND can use as private
              reference material in chat.
            </p>
          </div>

          <button
            type="button"
            className={
              styles.uploadButton
            }
            onClick={
              openFilePicker
            }
            disabled={uploading}
          >
            {uploading ? (
              <Loader2
                size={17}
                className={
                  styles.spin
                }
              />
            ) : (
              <Upload
                size={17}
              />
            )}
            <span>
              {uploading
                ? "Processing…"
                : "Add document"}
            </span>
          </button>

          <input
            ref={inputRef}
            type="file"
            hidden
            accept={ACCEPTED_TYPES.join(
              ",",
            )}
            onChange={
              handleFileInput
            }
          />
        </div>

        <div
          className={
            styles.searchPanel
          }
        >
          <form
            onSubmit={
              searchDocuments
            }
            className={
              styles.searchForm
            }
          >
            <Search
              size={18}
              aria-hidden="true"
            />

            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              placeholder="Search your documents…"
              aria-label="Search your documents"
            />

            {query ? (
              <button
                type="button"
                className={
                  styles.clearButton
                }
                onClick={
                  clearSearch
                }
                aria-label="Clear document search"
              >
                <X size={16} />
              </button>
            ) : null}

            <button
              type="submit"
              className={
                styles.searchButton
              }
              disabled={
                searching ||
                !query.trim()
              }
            >
              {searching ? (
                <Loader2
                  size={16}
                  className={
                    styles.spin
                  }
                />
              ) : (
                "Search"
              )}
            </button>
          </form>
        </div>

        {error ? (
          <div
            className={
              styles.error
            }
            role="alert"
          >
            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        {notice ? (
          <div
            className={
              styles.notice
            }
            role="status"
          >
            <CheckCircle2
              size={17}
            />
            <span>
              {notice}
            </span>
          </div>
        ) : null}

        {Array.isArray(
          results,
        ) ? (
          <section
            className={
              styles.resultsSection
            }
          >
            <div
              className={
                styles.sectionHeader
              }
            >
              <div>
                <h2>
                  Search results
                </h2>
                <span>
                  {results.length} relevant{" "}
                  {results.length === 1
                    ? "result"
                    : "results"}
                </span>
              </div>

              <button
                type="button"
                className={
                  styles.textButton
                }
                onClick={
                  clearSearch
                }
              >
                Back to library
              </button>
            </div>

            {results.length ? (
              <div
                className={
                  styles.resultList
                }
              >
                {results.map(
                  (
                    result,
                    index,
                  ) => (
                    <article
                      key={
                        result.id ||
                        `${result.document_id}-${index}`
                      }
                      className={
                        styles.result
                      }
                    >
                      <div
                        className={
                          styles.resultIcon
                        }
                      >
                        <FileText
                          size={18}
                        />
                      </div>

                      <div
                        className={
                          styles.resultBody
                        }
                      >
                        <strong>
                          {result.name ||
                            result.document_name ||
                            "Document"}
                        </strong>

                        <p>
                          {result.content}
                        </p>

                        <span>
                          Relevant passage
                        </span>
                      </div>
                    </article>
                  ),
                )}
              </div>
            ) : (
              <div
                className={
                  styles.emptySearch
                }
              >
                No relevant passages
                were found.
              </div>
            )}
          </section>
        ) : (
          <section
            className={
              styles.librarySection
            }
          >
            <div
              className={
                styles.sectionHeader
              }
            >
              <div>
                <h2>
                  Library
                </h2>

                <span>
                  {documents.length}{" "}
                  {documents.length === 1
                    ? "document"
                    : "documents"}
                </span>
              </div>

              <button
                type="button"
                className={
                  styles.refreshButton
                }
                onClick={
                  loadDocuments
                }
                disabled={loading}
                aria-label="Refresh documents"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? styles.spin
                      : ""
                  }
                />
              </button>
            </div>

            {loading ? (
              <div
                className={
                  styles.loading
                }
              >
                <Loader2
                  size={20}
                  className={
                    styles.spin
                  }
                />
                <span>
                  Loading your
                  documents…
                </span>
              </div>
            ) : documents.length ? (
              <div
                className={
                  styles.documentList
                }
              >
                {documents.map(
                  (document) => {
                    const Icon =
                      fileIcon(
                        document,
                      );

                    const isDeleting =
                      deletingId ===
                      document.id;

                    return (
                      <article
                        key={
                          document.id
                        }
                        className={
                          styles.document
                        }
                      >
                        <div
                          className={
                            styles.documentIcon
                          }
                        >
                          <Icon
                            size={20}
                          />
                        </div>

                        <div
                          className={
                            styles.documentInfo
                          }
                        >
                          <strong
                            title={
                              document.name
                            }
                          >
                            {
                              document.name
                            }
                          </strong>

                          <div
                            className={
                              styles.documentMeta
                            }
                          >
                            <span>
                              {formatBytes(
                                document.sizeBytes,
                              )}
                            </span>

                            <span>
                              {document.chunkCount ||
                                0}{" "}
                              chunks
                            </span>

                            {document.createdAt ? (
                              <span>
                                {formatDate(
                                  document.createdAt,
                                )}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div
                          className={
                            styles.documentStatus
                          }
                        >
                          {document.status ===
                          "ready" ? (
                            <span
                              className={
                                styles.ready
                              }
                            >
                              <CheckCircle2
                                size={15}
                              />
                              Ready
                            </span>
                          ) : document.status ===
                            "processing" ? (
                            <span
                              className={
                                styles.processing
                              }
                            >
                              <Loader2
                                size={15}
                                className={
                                  styles.spin
                                }
                              />
                              Processing
                            </span>
                          ) : (
                            <span
                              className={
                                styles.failed
                              }
                            >
                              Needs attention
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className={
                            styles.deleteButton
                          }
                          onClick={() =>
                            deleteDocument(
                              document,
                            )
                          }
                          disabled={
                            isDeleting
                          }
                          aria-label={`Delete ${document.name}`}
                          title="Delete document"
                        >
                          {isDeleting ? (
                            <Loader2
                              size={17}
                              className={
                                styles.spin
                              }
                            />
                          ) : (
                            <Trash2
                              size={17}
                            />
                          )}
                        </button>
                      </article>
                    );
                  },
                )}
              </div>
            ) : (
              <div
                className={
                  styles.empty
                }
              >
                <div
                  className={
                    styles.emptyIcon
                  }
                >
                  <FileText
                    size={25}
                  />
                </div>

                <h3>
                  No documents yet
                </h3>

                <p>
                  Add a TXT, Markdown,
                  CSV or JSON file to
                  build your private
                  OZLIND knowledge library.
                </p>

                <button
                  type="button"
                  className={
                    styles.emptyButton
                  }
                  onClick={
                    openFilePicker
                  }
                  disabled={
                    uploading
                  }
                >
                  <Upload
                    size={16}
                  />
                  Add your first document
                </button>
              </div>
            )}
          </section>
        )}

        <p
          className={
            styles.footerNote
          }
        >
          Documents are scoped to your
          OZLIND account. They are used as
          private reference material for
          document-aware responses.
        </p>
      </section>
    </main>
  );
}