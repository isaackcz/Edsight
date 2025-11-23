# Category & Topic Analysis - Data Sources

## Overview
This document details exactly where the data comes from for the Category & Topic Analysis report, specifically the school status counts (Started, Continuing, Finished, Not Started).

---

## Database Tables Used

### 1. `forms` Table
**Purpose:** Get the list of forms (each form = one school's submission)

**Columns Used:**
- `form_id` (INT, PRIMARY KEY) - Unique identifier for each form
- `school_id` (INT, FOREIGN KEY → `schools.id`) - Links form to a school
- `status` (VARCHAR(20)) - Form status: 'draft', 'in-progress', 'submitted', 'completed'
- `workflow_status` (ENUM) - Workflow position: 'draft', 'submitted', 'district_pending', 'district_approved', 'district_returned', 'division_pending', 'division_approved', 'division_returned', 'region_pending', 'region_approved', 'region_returned', 'central_pending', 'central_approved', 'central_returned', 'completed'
- `created_at` (TIMESTAMP) - Used for date range filtering
- `admin_id` (VARCHAR(255)) - References `admin_user.admin_id`

**How it's used:**
```python
# Get filtered forms based on date range, geographic filters, status, etc.
queryset = Form.objects.select_related('school', 'admin_user')
form_ids = list(queryset.values_list('form_id', flat=True))
```

**Filtering:**
- Date range: `forms.created_at` between `date_from` and `date_to`
- Geographic: `forms.school_id` → `schools.region_id`, `schools.division_id`, `schools.district_id`
- Status: `forms.status` or `forms.workflow_status`

---

### 2. `topics` Table
**Purpose:** Get all topics to analyze

**Columns Used:**
- `topic_id` (INT, PRIMARY KEY) - Unique identifier for each topic
- `name` (VARCHAR(100)) - Topic name
- `category_id` (INT, FOREIGN KEY → `categories.category_id`) - Links topic to category
- `display_order` (INT) - Order for display

**How it's used:**
```python
# Get all topics
for topic in Topic.objects.all():
    topic_id = topic.topic_id
    category_id = topic.category_id
```

---

### 3. `questions` Table
**Purpose:** Get all questions that belong to each topic

**Columns Used:**
- `question_id` (INT, PRIMARY KEY) - Unique identifier for each question
- `topic_id` (INT, FOREIGN KEY → `topics.topic_id`) - Links question to topic
- `question_text` (TEXT) - The actual question
- `answer_type` (ENUM: 'text', 'date', 'number', 'percentage') - Type of answer expected
- `is_required` (TINYINT(1)) - Whether question is required
- `display_order` (INT) - Order for display

**How it's used:**
```python
# Get all questions for a specific topic
topic_questions = Question.objects.filter(topic=topic)
topic_question_ids = list(topic_questions.values_list('question_id', flat=True))
total_questions = len(topic_question_ids)  # Count of questions in topic
```

---

### 4. `answers` Table
**Purpose:** Count how many questions each form has answered for each topic

**Columns Used:**
- `answer_id` (BIGINT, PRIMARY KEY) - Unique identifier for each answer
- `form_id` (INT, FOREIGN KEY → `forms.form_id`) - Links answer to a form
- `question_id` (INT, FOREIGN KEY → `questions.question_id`) - Links answer to a question
- `response` (TEXT, NULLABLE) - The actual answer text/value
- `answered_at` (TIMESTAMP) - When the answer was provided

**How it's used:**
```python
# For each form, count how many questions in a topic have been answered
answered_for_form = Answer.objects.filter(
    form_id=form_id,                    # Specific form
    question_id__in=topic_question_ids, # Questions in this topic
    response__isnull=False              # Must have a response
).exclude(response='').count()          # Exclude empty strings
```

**Key Logic:**
- Only counts answers where `response IS NOT NULL`
- Excludes answers where `response = ''` (empty string)
- Counts distinct answer records (one per question per form)

---

## Data Flow

### Step 1: Get Filtered Forms
```
forms table
  ↓ (filtered by date, region, division, district, school, status)
form_ids = [59, 60, 61, ...]  # List of form IDs
```

### Step 2: For Each Topic
```
topics table
  ↓
topic_id = 895
  ↓
questions table (WHERE topic_id = 895)
  ↓
topic_question_ids = [101, 102, 103, ..., 117]  # 17 questions
total_questions = 17
```

### Step 3: For Each Form, Count Answers
```
For form_id = 59:
  answers table
    WHERE form_id = 59
    AND question_id IN (101, 102, 103, ..., 117)
    AND response IS NOT NULL
    AND response != ''
  ↓
answered_for_form = 11  # 11 out of 17 questions answered
```

### Step 4: Categorize Each Form
```
IF answered_for_form == 0:
    → Not Started
ELIF answered_for_form == total_questions AND total_questions > 0:
    → Finished (also counts as Started)
ELIF answered_for_form > 0:
    → Continuing (also counts as Started)
```

### Step 5: Aggregate Counts
```
Count all forms in each category:
- not_started_count = 20
- started_count = 50 (includes continuing + finished)
- continuing_count = 30
- finished_count = 20
```

---

## Status Definitions

### Not Started
- **Condition:** `answered_for_form == 0`
- **Meaning:** Form has answered 0 questions in this topic
- **SQL Equivalent:**
```sql
SELECT COUNT(*) FROM forms f
WHERE f.form_id IN (form_ids)
AND NOT EXISTS (
    SELECT 1 FROM answers a
    WHERE a.form_id = f.form_id
    AND a.question_id IN (topic_question_ids)
    AND a.response IS NOT NULL
    AND a.response != ''
)
```

### Started
- **Condition:** `answered_for_form > 0`
- **Meaning:** Form has answered at least 1 question in this topic
- **Includes:** Both "Continuing" and "Finished" forms
- **SQL Equivalent:**
```sql
SELECT COUNT(DISTINCT f.form_id) FROM forms f
INNER JOIN answers a ON a.form_id = f.form_id
WHERE f.form_id IN (form_ids)
AND a.question_id IN (topic_question_ids)
AND a.response IS NOT NULL
AND a.response != ''
```

### Continuing
- **Condition:** `answered_for_form > 0 AND answered_for_form < total_questions`
- **Meaning:** Form has answered some questions but not all
- **SQL Equivalent:**
```sql
SELECT COUNT(DISTINCT f.form_id) FROM forms f
INNER JOIN answers a ON a.form_id = f.form_id
WHERE f.form_id IN (form_ids)
AND a.question_id IN (topic_question_ids)
AND a.response IS NOT NULL
AND a.response != ''
GROUP BY f.form_id
HAVING COUNT(DISTINCT a.question_id) < total_questions
```

### Finished
- **Condition:** `answered_for_form == total_questions AND total_questions > 0`
- **Meaning:** Form has answered ALL questions in this topic
- **SQL Equivalent:**
```sql
SELECT COUNT(DISTINCT f.form_id) FROM forms f
INNER JOIN answers a ON a.form_id = f.form_id
WHERE f.form_id IN (form_ids)
AND a.question_id IN (topic_question_ids)
AND a.response IS NOT NULL
AND a.response != ''
GROUP BY f.form_id
HAVING COUNT(DISTINCT a.question_id) = total_questions
```

---

## Relationships

```
forms (1) ──→ (N) answers
  ↓
schools (via school_id)

questions (1) ──→ (N) answers
  ↓
topics (via topic_id)
  ↓
categories (via category_id)
```

---

## Important Notes

1. **One Form = One School**: Each form represents one school's submission
2. **Multiple Answers Possible**: A form can have multiple answers (one per question)
3. **Topic-Based Analysis**: Status is calculated per topic, not per form overall
4. **Empty Responses Excluded**: Only answers with non-null, non-empty `response` are counted
5. **No ENUM for Status**: The statuses (Not Started, Started, Continuing, Finished) are calculated dynamically, not stored as ENUM values

---

## Example Query Flow

**Scenario:** 100 schools, topic with 10 questions

```python
# Step 1: Get 100 forms
form_ids = [1, 2, 3, ..., 100]

# Step 2: Get topic questions
topic_question_ids = [101, 102, 103, ..., 110]  # 10 questions

# Step 3: For each form, count answers
Form 1: answered = 0  → Not Started
Form 2: answered = 5  → Continuing (also Started)
Form 3: answered = 10 → Finished (also Started)
...
Form 100: answered = 3 → Continuing (also Started)

# Step 4: Aggregate
not_started = 20
started = 80 (includes continuing + finished)
continuing = 60
finished = 20
```

---

## Code Location

**File:** `apps/analytics/services.py`
**Method:** `get_category_topic_analysis()`
**Lines:** 2576-2611

