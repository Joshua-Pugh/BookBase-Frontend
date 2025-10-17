// ---- Config and DOM refs ----
const BASE_API_URL = 'https://bookbase-mix2.onrender.com/api/books';

const form = document.getElementById('bookForm');
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const summaryInput = document.getElementById('summary');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelEditBtn');
const listEl = document.getElementById('bookList');

let editingId = null; // null = create mode, number = edit mode

// ---- UX helpers (spinner + toast) ----
function showLoader() {document.getElementById('loader').classList.remove('hidden'); }
function hideLoader() {document.getElementById('loader').classList.add('hidden'); }

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#e74c3c' : '#27ae60';
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(()=> {toast.classList.remove('show'); }, 2500);
}

// ---- Rendering ---- 
function renderBooks (books) {
    // clear current UI
    listEl.innerHTML = '';

    books.forEach(book => {
        const li = document.createElement('li');
        li.className = 'book-item';
        li.dataset.summary = book.summary || '';

        li.innerHTML = `
          <div class="book-info">
            <span class="book-title">${escapeHtml(book.title)}</span> -
            <i class="book-author">${escapeHtml(book.author)}</i>
          </div>
          <div class="action">
            <button class="edit-btn" data-id="${book.id}">Edit</button>
            <button class="delete-btn" data-id="${book.id}">Delete</button>
          </div>
        `;
        listEl.appendChild(li);
    });
}

// Prevent XSS when inserting user text into HTML

function escapeHtml(str = '') {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
}

// ---- Data fetch ----
async function loadBooks() {
    showLoader();
    try {
        const res = await fetch(BASE_API_URL, { method: 'GET' });
        if (!res.ok) throw new Error(`GET /books failed: ${res.status}`);
        const data = await res.json();
        renderBooks(data);
    } catch(err) {
        console.error(err);
        showToast('Failed to load books', 'error');
    } finally {
        hideLoader();
    }
}

// ---- Form Submission ----
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    const summary = summaryInput.value.trim();

    if (!title || !author) {
        showToast('Both fields are required', 'error');
        return;
    } 
    
    if (editingId) {
        await updateBook(editingId, title, author, summary);
    } else {
        await createBook(title, author, summary);
    }

    // rest form
    titleInput.value = '';
    authorInput.value = '';
    summaryInput.value = '';
    editingId = null;
    submitBtn = 'Add Book';
    cancelBtn = 'hidden';

});

// ---- List Button Handling ----

listEl.addEventListener('click', async (e) => {
    const li = e.target.closest('.book-item');
    if (!li) return; // clicked outside any list item

    const id = li.querySelector('.edit-btn')?.dataset.id;

    // get book data from element
    const book = {
        title: li.querySelector('.book-title').textContent,
        author: li.querySelector('.book-author').textContent,
        summary: li.dataset.summary || ''
    };

    // If the user clicked anywhere on the card *except* buttons → open modal
    if (
        !e.target.classList.contains('edit-btn') &&
        !e.target.classList.contains('delete-btn')
    ) {
        openBookModal(book);
        return;
    }

    if (e.target.classList.contains('edit-btn')) {
        const li = e.target.closest('.book-item');
        const title = li.querySelector('.book-title').textContent;
        const author = li.querySelector('.book-author').textContent;
        const summary = li.dataset.summary || '';

        // Populate form
        titleInput.value = title;
        authorInput.value = author;
        summaryInput.value = summary;
        editingId = id;

        // Change button text and show cancel button
        submitBtn.textContent = 'Update Book';
        cancelBtn.classList.remove('hidden');

        //Scroll to top smoothly
        window.scrollTo({
            top:0,
            behavior: 'smooth'
        });
    }

    if (e.target.classList.contains('delete-btn')) {
        if (await confirmDelete('Are you sure you want to delete this book?')) {
            await deleteBook(id);
        }
    }
});

cancelBtn.addEventListener('click', () => {
    editingId = null;
    titleInput.value = '';
    authorInput.value = '';
    summaryInput.value = '';
    submitBtn.textContent = 'Add Book';
    cancelBtn.classList.add('hidden');
    showToast('Edit canceled');
});

// ---- CRUD functions and helpers ----

async function createBook(title, author, summary) {
    showLoader();
    try {
        const res = await fetch(`${BASE_API_URL}/createOne`, {
            method: 'Post',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, author, summary})
        });

        if (!res.ok) throw new Error(`Failed to create book: ${res.status}`);
        showToast('Book added successfully');
    } catch(err) {
        console.error(err);
    } finally {
        hideLoader();
    }

    // refresh list
    loadBooks();
}

async function updateBook(id, title, author, summary) {
    showLoader();
    try {
        const res = await fetch(`${BASE_API_URL}/updateOne/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, author, summary })
        });

        if (!res.ok) throw new Error(`Update failed: ${res.status}`);
        showToast('Book updated successfully');
    } catch (err) {
        console.error(err);
        showToast('Error updating book', 'error');
    }finally {
        hideLoader();
    }
}

async function deleteBook(id) {
    showLoader();
    try {
        const res = await fetch(`${BASE_API_URL}/deleteOne/${id}`, { method: 'DELETE' });

        if (!res.ok) throw new Error('Delete failed');
        showToast('Book deleted successfully');
    } catch(err) {
        console.error(err);
        showToast('Failed to delete book', 'error');
    } finally {
        hideLoader();
    }

    // refresh list
    loadBooks();
}

function confirmDelete(message) {
  const modal = document.getElementById('confirmModal');
  const yesBtn = document.getElementById('confirmYes');
  const noBtn = document.getElementById('confirmNo');
  const msg = document.getElementById('confirmMessage');

  msg.textContent = message;
  modal.classList.remove('hidden');

  return new Promise((resolve) => {
    const handleYes = () => closeModal(true);
    const handleNo = () => closeModal(false);

    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);

    function closeModal(result) {
      modal.classList.add('hidden');
      yesBtn.removeEventListener('click', handleYes);
      noBtn.removeEventListener('click', handleNo);
      resolve(result);
    }
  });
}

// ---- Book Modal Logic ----
const bookModal = document.getElementById('bookModal');
const closeBookModal = document.getElementById('closeBookModal');
const modalTitle = document.getElementById('modalTitle');
const modalAuthor = document.getElementById('modalAuthor');
const modalSummary = document.getElementById('modalSummary');

function openBookModal(book) {
  modalTitle.textContent = book.title;
  modalAuthor.textContent = book.author;
  modalSummary.textContent = book.summary || 'No summary available.';
  bookModal.classList.remove('hidden');
}

closeBookModal.addEventListener('click', () => {
  bookModal.classList.add('hidden');
});

// Close when clicking outside the box
bookModal.addEventListener('click', (e) => {
  if (e.target === bookModal) bookModal.classList.add('hidden');
});

// Boot
loadBooks();


// ---- Feedback Form ----

const feedbackBtn = document.getElementById('feedbackFab');
const feedbackModal = document.getElementById('feedbackModal');
const closeFeedbackBtn = document.getElementById('closeFeedbackBtn');
const feedbackForm = document.getElementById('feedbackForm');

feedbackBtn.addEventListener('click', () => {
  feedbackModal.classList.remove('hidden');
});

closeFeedbackBtn.addEventListener('click', () => {
  feedbackModal.classList.add('hidden');
});

feedbackForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('feedbackEmail').value;
  const message = document.getElementById('feedbackMessage').value;

  showLoader();
  try {
    const res = await fetch('https://formspree.io/f/xjkaljql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, message })
    });

    if (!res.ok) throw new Error('Submission failed');

    showToast('Feedback sent successfully!');
    feedbackModal.classList.add('hidden');
    feedbackForm.reset();
  } catch (err) {
    console.error(err);
    showToast('Failed to send feedback', 'error');
  } finally {
    hideLoader();
  }
});