// Replace this with your deployed Cloudflare Worker URL after deployment.
const WORKER_URL = 'https://REPLACE_WITH_YOUR_WORKER_URL';

const form = document.getElementById('evaluationForm');
const evaluateButton = document.getElementById('evaluateButton');
const statusMessage = document.getElementById('statusMessage');
const resultsSection = document.getElementById('resultsSection');
const downloadPdfButton = document.getElementById('downloadPdfButton');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');

let lastSubmission = null;
let lastEvaluation = null;

function applyTheme(theme) {
  const normalized = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = normalized;
  localStorage.setItem('requirementsCriteriaThemeV2', normalized);

  if (normalized === 'dark') {
    themeIcon.textContent = '☀️';
    themeLabel.textContent = 'Light mode';
    themeToggle.setAttribute('aria-label', 'Switch to light mode');
  } else {
    themeIcon.textContent = '🌙';
    themeLabel.textContent = 'Dark mode';
    themeToggle.setAttribute('aria-label', 'Switch to dark mode');
  }
}

applyTheme(localStorage.getItem('requirementsCriteriaThemeV2') || 'dark');

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('error', isError);
}

function createList(items) {
  const ul = document.createElement('ul');
  for (const item of items || []) {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  }
  return ul;
}

function appendFeedbackGroup(parent, title, items) {
  if (!Array.isArray(items) || items.length === 0) return;

  const group = document.createElement('div');
  group.className = 'feedback-group';
  const heading = document.createElement('h4');
  heading.textContent = title;
  group.appendChild(heading);
  group.appendChild(createList(items));
  parent.appendChild(group);
}

function renderFeedbackCards(container, items) {
  container.replaceChildren();

  for (const item of items || []) {
    const card = document.createElement('article');
    card.className = 'feedback-card';

    const header = document.createElement('div');
    header.className = 'feedback-card-header';

    const statement = document.createElement('p');
    statement.className = 'statement';
    statement.textContent = item.original_statement || '(Statement not returned)';

    const classification = document.createElement('span');
    classification.className = 'classification';
    classification.textContent = String(item.classification || 'unclear').replaceAll('_', ' ');

    header.append(statement, classification);
    card.appendChild(header);

    appendFeedbackGroup(card, 'What is working', item.strengths);
    appendFeedbackGroup(card, 'Issues to examine', item.issues);
    appendFeedbackGroup(card, 'Questions to discuss', item.prompting_questions);

    if (item.format_note) {
      const note = document.createElement('p');
      note.className = 'format-note';
      const strong = document.createElement('strong');
      strong.textContent = 'Course format reminder: ';
      note.append(strong, document.createTextNode(item.format_note));
      card.appendChild(note);
    }

    container.appendChild(card);
  }
}

function renderSimpleList(panelId, listId, items) {
  const panel = document.getElementById(panelId);
  const list = document.getElementById(listId);
  list.replaceChildren();

  if (!Array.isArray(items) || items.length === 0) {
    panel.hidden = true;
    return;
  }

  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  }
  panel.hidden = false;
}

function renderEvaluation(evaluation) {
  document.getElementById('overallSummary').textContent = evaluation.overall_summary;
  renderSimpleList('contextPanel', 'contextObservations', evaluation.context_observations);
  renderFeedbackCards(document.getElementById('requirementsFeedback'), evaluation.requirements_analysis);
  renderFeedbackCards(document.getElementById('criteriaFeedback'), evaluation.criteria_analysis);
  renderSimpleList('considerationsPanel', 'considerations', evaluation.things_worth_considering);

  const discussionPanel = document.getElementById('discussionPanel');
  const discussionList = document.getElementById('discussionQuestions');
  discussionList.replaceChildren();
  if (evaluation.team_discussion_questions?.length) {
    evaluation.team_discussion_questions.forEach((question) => {
      const li = document.createElement('li');
      li.textContent = question;
      discussionList.appendChild(li);
    });
    discussionPanel.hidden = false;
  } else {
    discussionPanel.hidden = true;
  }

  resultsSection.hidden = false;
  resultsSection.focus({ preventScroll: true });
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const design_context = document.getElementById('designContext').value.trim();
  const requirements = document.getElementById('requirements').value.trim();
  const criteria = document.getElementById('criteria').value.trim();

  if (!design_context || !requirements || !criteria) {
    setStatus('Please complete all three sections before requesting feedback.', true);
    return;
  }

  if (WORKER_URL.includes('REPLACE_WITH')) {
    setStatus('Setup is incomplete: add your deployed Cloudflare Worker URL in app.js.', true);
    return;
  }

  lastSubmission = { design_context, requirements, criteria };
  lastEvaluation = null;
  resultsSection.hidden = true;
  evaluateButton.disabled = true;
  evaluateButton.textContent = 'Evaluating...';
  setStatus('Analyzing your requirements and criteria. This may take a moment.');

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lastSubmission),
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      throw new Error('The server returned an unreadable response.');
    }

    if (!response.ok) {
      throw new Error(data.error || 'The evaluator could not complete the request.');
    }

    if (!data.evaluation) {
      throw new Error('The evaluator returned no feedback.');
    }

    lastEvaluation = data.evaluation;
    renderEvaluation(lastEvaluation);
    setStatus('Evaluation complete. Review the feedback with your team.');
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Something went wrong. Please try again.', true);
  } finally {
    evaluateButton.disabled = false;
    evaluateButton.textContent = 'Evaluate Requirements & Criteria';
  }
});

function addWrappedText(doc, text, x, y, options = {}) {
  const {
    width = 170,
    fontSize = 10.5,
    fontStyle = 'normal',
    lineHeight = 5.2,
    indent = 0,
  } = options;

  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(String(text ?? ''), width - indent);

  for (const line of lines) {
    if (y > 278) {
      doc.addPage();
      y = 18;
    }
    doc.text(line, x + indent, y);
    y += lineHeight;
  }
  return y;
}

function addSectionHeading(doc, title, y) {
  if (y > 266) {
    doc.addPage();
    y = 18;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, 20, y);
  return y + 8;
}

function addBulletList(doc, items, y, numbered = false) {
  (items || []).forEach((item, index) => {
    const prefix = numbered ? `${index + 1}. ` : '• ';
    y = addWrappedText(doc, `${prefix}${item}`, 20, y, { width: 170, indent: 4 });
    y += 1.5;
  });
  return y;
}

function addAnalysisItems(doc, title, items, y) {
  y = addSectionHeading(doc, title, y);

  (items || []).forEach((item, index) => {
    if (y > 252) {
      doc.addPage();
      y = 18;
    }
    y = addWrappedText(doc, `${index + 1}. ${item.original_statement || ''}`, 20, y, {
      width: 170,
      fontStyle: 'bold',
      fontSize: 10.5,
    });
    y = addWrappedText(doc, `Classification: ${String(item.classification || '').replaceAll('_', ' ')}`, 24, y, {
      width: 166,
      fontSize: 9.5,
    });

    const groups = [
      ['What is working', item.strengths],
      ['Issues to examine', item.issues],
      ['Questions to discuss', item.prompting_questions],
    ];

    for (const [label, values] of groups) {
      if (Array.isArray(values) && values.length) {
        y = addWrappedText(doc, `${label}:`, 24, y + 1.5, { width: 166, fontStyle: 'bold', fontSize: 9.5 });
        for (const value of values) {
          y = addWrappedText(doc, `• ${value}`, 28, y, { width: 162, fontSize: 9.5 });
        }
      }
    }

    if (item.format_note) {
      y = addWrappedText(doc, `Course format reminder: ${item.format_note}`, 24, y + 1.5, {
        width: 166,
        fontStyle: 'italic',
        fontSize: 9.5,
      });
    }
    y += 5;
  });

  return y;
}

downloadPdfButton.addEventListener('click', () => {
  if (!lastSubmission || !lastEvaluation) {
    setStatus('Complete an evaluation before downloading the PDF.', true);
    return;
  }

  if (!window.jspdf?.jsPDF) {
    setStatus('The PDF library did not load. Check your internet connection and try again.', true);
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const timestamp = new Date();
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Requirements & Criteria Evaluation', 20, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Generated: ${timestamp.toLocaleString()}`, 20, y);
  y += 10;

  y = addSectionHeading(doc, 'Student Inputs', y);
  y = addWrappedText(doc, 'Design Context', 20, y, { fontStyle: 'bold' });
  y = addWrappedText(doc, lastSubmission.design_context, 20, y, { width: 170 });
  y += 5;
  y = addWrappedText(doc, 'Proposed Requirements', 20, y, { fontStyle: 'bold' });
  y = addWrappedText(doc, lastSubmission.requirements, 20, y, { width: 170 });
  y += 5;
  y = addWrappedText(doc, 'Proposed Criteria', 20, y, { fontStyle: 'bold' });
  y = addWrappedText(doc, lastSubmission.criteria, 20, y, { width: 170 });
  y += 8;

  y = addSectionHeading(doc, 'AI Evaluation', y);
  y = addWrappedText(doc, lastEvaluation.overall_summary, 20, y, { width: 170 });
  y += 5;

  if (lastEvaluation.context_observations?.length) {
    y = addSectionHeading(doc, 'Context Observations', y);
    y = addBulletList(doc, lastEvaluation.context_observations, y);
    y += 3;
  }

  y = addAnalysisItems(doc, 'Requirements Feedback', lastEvaluation.requirements_analysis, y);
  y = addAnalysisItems(doc, 'Criteria Feedback', lastEvaluation.criteria_analysis, y);

  if (lastEvaluation.things_worth_considering?.length) {
    y = addSectionHeading(doc, 'Things Worth Considering', y);
    y = addBulletList(doc, lastEvaluation.things_worth_considering, y);
    y += 3;
  }

  if (lastEvaluation.team_discussion_questions?.length) {
    y = addSectionHeading(doc, 'Team Discussion Questions', y);
    y = addBulletList(doc, lastEvaluation.team_discussion_questions, y, true);
    y += 5;
  }

  y = addWrappedText(
    doc,
    'AI-generated formative feedback intended to support team discussion and revision. The team remains responsible for engineering judgments and final decisions.',
    20,
    y,
    { width: 170, fontSize: 8.5, fontStyle: 'italic' },
  );

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Page ${page} of ${pageCount}`, 190, 273, { align: 'right' });
  }

  const datePart = timestamp.toISOString().slice(0, 10);
  doc.save(`requirements_criteria_evaluation_${datePart}.pdf`);
});
