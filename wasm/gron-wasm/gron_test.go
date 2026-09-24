package main

import (
	"strings"
	"testing"
)

func TestToGron_Basic(t *testing.T) {
	got, err := ToGron(`{"name":"neko","active":true,"count":3,"note":null}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := strings.Join([]string{
		`json = {};`,
		`json.active = true;`,
		`json.count = 3;`,
		`json.name = "neko";`,
		`json.note = null;`,
	}, "\n")
	if got != want {
		t.Fatalf("got:\n%s\nwant:\n%s", got, want)
	}
}

func TestToGron_NestedObjectAndArray(t *testing.T) {
	got, err := ToGron(`{"tags":["a","b"],"nested":{"id":1}}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := strings.Join([]string{
		`json = {};`,
		`json.nested = {};`,
		`json.nested.id = 1;`,
		`json.tags = [];`,
		`json.tags[0] = "a";`,
		`json.tags[1] = "b";`,
	}, "\n")
	if got != want {
		t.Fatalf("got:\n%s\nwant:\n%s", got, want)
	}
}

func TestToGron_NonIdentifierKeyUsesBracketNotation(t *testing.T) {
	got, err := ToGron(`{"weird-key":1,"2bad":2}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(got, `json["weird-key"] = 1;`) {
		t.Fatalf("expected bracket notation for weird-key, got:\n%s", got)
	}
	if !strings.Contains(got, `json["2bad"] = 2;`) {
		t.Fatalf("expected bracket notation for 2bad, got:\n%s", got)
	}
}

func TestToGron_PreservesNumberText(t *testing.T) {
	got, err := ToGron(`{"pi":3.140,"big":9007199254740993}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(got, `json.pi = 3.140;`) {
		t.Fatalf("expected original number text 3.140 to be preserved, got:\n%s", got)
	}
	if !strings.Contains(got, `json.big = 9007199254740993;`) {
		t.Fatalf("expected big integer precision to be preserved, got:\n%s", got)
	}
}

func TestToGron_InvalidJSON(t *testing.T) {
	if _, err := ToGron(`{not json`); err == nil {
		t.Fatal("expected an error for invalid JSON")
	}
}

func TestFromGron_RoundTrip(t *testing.T) {
	original := `{"active":true,"count":3,"name":"neko","nested":{"id":1},"note":null,"tags":["a","b"]}`
	gron, err := ToGron(original)
	if err != nil {
		t.Fatalf("ToGron failed: %v", err)
	}
	back, err := FromGron(gron)
	if err != nil {
		t.Fatalf("FromGron failed: %v", err)
	}
	roundTripped, err := ToGron(back)
	if err != nil {
		t.Fatalf("ToGron(back) failed: %v", err)
	}
	if roundTripped != gron {
		t.Fatalf("round trip mismatch:\nfirst:\n%s\nsecond:\n%s", gron, roundTripped)
	}
}

func TestFromGron_BracketNotation(t *testing.T) {
	gron := strings.Join([]string{
		`json = {};`,
		`json["weird-key"] = 1;`,
	}, "\n")
	got, err := FromGron(gron)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(got, `"weird-key": 1`) {
		t.Fatalf("expected weird-key in output, got:\n%s", got)
	}
}

func TestFromGron_MissingEquals(t *testing.T) {
	if _, err := FromGron("json.a 1;"); err == nil {
		t.Fatal("expected an error for a line without ' = '")
	}
}

func TestFromGron_EmptyInput(t *testing.T) {
	if _, err := FromGron("   \n\n"); err == nil {
		t.Fatal("expected an error for empty input")
	}
}
