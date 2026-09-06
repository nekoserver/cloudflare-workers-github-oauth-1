package main

import (
	"strings"
	"testing"
)

func TestParseQueryAnnotations_Basic(t *testing.T) {
	input := `-- name: GetAuthor :one
SELECT * FROM authors
WHERE id = $1;

-- name: ListAuthors :many
SELECT * FROM authors
ORDER BY name;
`
	got := parseQueryAnnotations(input)
	if len(got.Errors) != 0 {
		t.Fatalf("unexpected errors: %+v", got.Errors)
	}
	if len(got.Queries) != 2 {
		t.Fatalf("expected 2 queries, got %d: %+v", len(got.Queries), got.Queries)
	}
	if got.Queries[0].Name != "GetAuthor" || got.Queries[0].Command != "one" || got.Queries[0].Line != 1 {
		t.Fatalf("unexpected first query: %+v", got.Queries[0])
	}
	if !strings.Contains(got.Queries[0].SQL, "WHERE id = $1;") {
		t.Fatalf("unexpected SQL body: %q", got.Queries[0].SQL)
	}
	if got.Queries[1].Name != "ListAuthors" || got.Queries[1].Command != "many" || got.Queries[1].Line != 5 {
		t.Fatalf("unexpected second query: %+v", got.Queries[1])
	}
}

func TestParseQueryAnnotations_UnknownCommand(t *testing.T) {
	input := `-- name: DeleteAuthor :onee
DELETE FROM authors WHERE id = $1;
`
	got := parseQueryAnnotations(input)
	if len(got.Queries) != 0 {
		t.Fatalf("expected 0 queries, got %+v", got.Queries)
	}
	if len(got.Errors) != 1 || !strings.Contains(got.Errors[0].Message, "onee") {
		t.Fatalf("expected unknown command error, got %+v", got.Errors)
	}
}

func TestParseQueryAnnotations_InvalidIdentifier(t *testing.T) {
	input := `-- name: 1Bad :one
SELECT 1;
`
	got := parseQueryAnnotations(input)
	if len(got.Queries) != 0 {
		t.Fatalf("expected 0 queries, got %+v", got.Queries)
	}
	if len(got.Errors) != 1 || !strings.Contains(got.Errors[0].Message, "不正です") {
		t.Fatalf("expected invalid identifier error, got %+v", got.Errors)
	}
}

func TestParseQueryAnnotations_DuplicateName(t *testing.T) {
	input := `-- name: GetAuthor :one
SELECT 1;

-- name: GetAuthor :many
SELECT 2;
`
	got := parseQueryAnnotations(input)
	if len(got.Queries) != 1 {
		t.Fatalf("expected 1 query (first wins), got %+v", got.Queries)
	}
	if len(got.Errors) != 1 || !strings.Contains(got.Errors[0].Message, "重複") {
		t.Fatalf("expected duplicate name error, got %+v", got.Errors)
	}
}

func TestParseQueryAnnotations_MalformedAnnotationLine(t *testing.T) {
	input := `-- name: only name no colon
SELECT 1;
`
	got := parseQueryAnnotations(input)
	if len(got.Queries) != 0 {
		t.Fatalf("expected 0 queries, got %+v", got.Queries)
	}
	if len(got.Errors) != 1 || !strings.Contains(got.Errors[0].Message, "形式が不正") {
		t.Fatalf("expected malformed annotation error, got %+v", got.Errors)
	}
}

func TestParseQueryAnnotations_MissingName(t *testing.T) {
	input := `-- name:  :one
SELECT 1;
`
	got := parseQueryAnnotations(input)
	if len(got.Queries) != 0 {
		t.Fatalf("expected 0 queries, got %+v", got.Queries)
	}
	if len(got.Errors) != 1 || !strings.Contains(got.Errors[0].Message, "空です") {
		t.Fatalf("expected empty name error, got %+v", got.Errors)
	}
}

func TestParseQueryAnnotations_NoAnnotations(t *testing.T) {
	got := parseQueryAnnotations("SELECT 1;\n")
	if len(got.Queries) != 0 || len(got.Errors) != 0 {
		t.Fatalf("expected empty result, got %+v", got)
	}
}

func TestFormatResultMarkdown_EscapesPipeAndNewline(t *testing.T) {
	result := parseQueryAnnotations("-- name: Weird :exec\nSELECT '|' AS x\nFROM t;\n")
	md := formatResultMarkdown(result)
	if !strings.Contains(md, `\|`) {
		t.Fatalf("expected escaped pipe in markdown, got %q", md)
	}
	lines := strings.Split(strings.TrimRight(md, "\n"), "\n")
	found := false
	for _, l := range lines {
		if strings.HasPrefix(l, "| ") && strings.Contains(l, "Weird") {
			found = true
			if !strings.Contains(l, "SELECT '\\|' AS x FROM t;") {
				t.Fatalf("expected flattened single-line SQL body, got %q", l)
			}
		}
	}
	if !found {
		t.Fatalf("expected a row containing the query name, got markdown: %q", md)
	}
}

func TestFormatResultMarkdown_NoBoxDrawingCharacters(t *testing.T) {
	result := parseQueryAnnotations("-- name: GetAuthor :one\nSELECT 1;\n")
	md := formatResultMarkdown(result)
	for _, r := range []rune{'─', '│', '┼', '├', '└', '▼'} {
		if strings.ContainsRune(md, r) {
			t.Fatalf("markdown must not contain box-drawing character %q", r)
		}
	}
}
