const fs = require('fs');
const path = require('path');

const filesToFix = [
  "src/components/NewBookingModal.jsx",
  "src/components/SponsorPaymentModal.jsx",
  "src/components/ClassModal.jsx",
  "src/components/FutsalEvaluationGrid.jsx",
  "src/components/FootballEvaluationGrid.jsx",
  "src/components/TennisAssessmentView.jsx",
  "src/pages/POSPage.jsx",
  "src/pages/PengaturanPage.jsx",
  "src/components/EventDetailModal.jsx",
  "src/components/EvaluationSection.jsx",
  "src/pages/EventManagementPage.jsx",
  "src/pages/EventDetailPage.jsx"
];

function camelToKebab(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function deriveIdAndName(tagStr, fileBase, lineIdx) {
  // Try value matching like value={foo.bar} or value={bar}
  let match = tagStr.match(/value=\{([^}]+)\}/);
  let baseName = '';
  if (match) {
    const rawVal = match[1].replace(/^(state\.|this\.|e\.|props\.)/, '').trim();
    // e.g., eventForm.sport -> event-form-sport
    baseName = rawVal.replace(/[^a-zA-Z0-9_.]/g, '').replace(/\./g, '-');
  }
  if (!baseName) {
    let pMatch = tagStr.match(/placeholder=["']([^"']+)["']/);
    if (pMatch) {
      baseName = pMatch[1].slice(0, 20).replace(/[^a-zA-Z0-9]/g, '-');
    }
  }
  if (!baseName) {
    let tMatch = tagStr.match(/type=["']([^"']+)["']/);
    baseName = (tMatch ? tMatch[1] : 'field') + '-' + lineIdx;
  }

  let kebab = camelToKebab(baseName).replace(/^-+|-+$/g, '').replace(/--+/g, '-');
  if (!kebab) kebab = 'input-' + lineIdx;

  const filePrefix = camelToKebab(fileBase).replace('-modal', '').replace('-page', '');
  const id = `${filePrefix}-${kebab}`;
  const name = baseName.replace(/-/g, '_') || kebab;

  return { id, name };
}

filesToFix.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  const fileBase = path.basename(filePath, path.extname(filePath));
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/<(input|select|textarea)\b/i.test(line)) {
      // Find full tag span
      let startLine = i;
      let endLine = i;
      let fullTag = line;
      while (endLine < lines.length && !lines[endLine].includes('>')) {
        endLine++;
        fullTag += '\n' + lines[endLine];
      }

      const hasId = /\bid\s*=/i.test(fullTag);
      const hasName = /\bname\s*=/i.test(fullTag);

      if (!hasId || !hasName) {
        let tagId = '';
        let tagName = '';

        if (hasId) {
          const idMatch = fullTag.match(/\bid=["']([^"']+)["']/i) || fullTag.match(/\bid=\{([^}]+)\}/i);
          if (idMatch) {
            tagId = idMatch[1];
            tagName = idMatch[1];
          }
        }

        if (!tagId) {
          const derived = deriveIdAndName(fullTag, fileBase, i + 1);
          tagId = derived.id;
          tagName = derived.name;
        }

        let newTag = fullTag;

        if (!hasId) {
          newTag = newTag.replace(/<(input|select|textarea)\b/i, `<$1\n  id="${tagId}"`);
        }
        if (!hasName) {
          newTag = newTag.replace(/<(input|select|textarea)\b/i, `<$1\n  name="${tagName}"`);
        }

        // Add aria-label if no label associated
        if (!/aria-label/i.test(newTag) && !/aria-labelledby/i.test(newTag)) {
          let ariaText = tagId.replace(/-/g, ' ');
          let pMatch = fullTag.match(/placeholder=["']([^"']+)["']/);
          if (pMatch) ariaText = pMatch[1];
          newTag = newTag.replace(/<(input|select|textarea)\b/i, `<$1\n  aria-label="${ariaText}"`);
        }

        // Replace tag in lines
        const newTagLines = newTag.split('\n');
        lines.splice(startLine, endLine - startLine + 1, ...newTagLines);
        i = startLine + newTagLines.length - 1;
        modified = true;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
