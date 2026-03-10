#!/usr/bin/env node

// Usage: node transform-timeline.js input.csv output.csv

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('Usage: node transform-timeline.js <input.csv> <output.csv>');
  process.exit(1);
}

// Minimal CSV parser that handles quoted fields (including quoted newlines)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n') {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }

  // Last field/row
  if (field.trim() || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

function escapeCSV(value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

const text = fs.readFileSync(inputFile, 'utf8');
const rows = parseCSV(text);

if (rows.length < 2) {
  console.error('CSV has fewer than 2 rows — nothing to process.');
  process.exit(1);
}

const headers = rows[0];
// headers[0] = "Year", headers[1] = "Date", headers[2..] = character names
const characters = headers.slice(2).map(h => h.replace(/\n/g, ' ').trim());

const outputRows = [['date', 'character', 'event']];

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const year = (row[0] || '').trim();
  const datePart = (row[1] || '').trim();

  if (!year) continue;

  // Build a combined date string
  const date = datePart ? `${year} ${datePart}` : year;

  for (let c = 2; c < headers.length; c++) {
    const event = (row[c] || '').replace(/\n/g, ' ').trim();
    if (!event) continue;

    const character = characters[c - 2];
    outputRows.push([date, character, event]);
  }
}

const csvLines = outputRows.map(r => r.map(escapeCSV).join(','));
fs.writeFileSync(outputFile, csvLines.join('\n') + '\n', 'utf8');

console.log(`Done. ${outputRows.length - 1} events written to ${outputFile}`);