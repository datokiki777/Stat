// App identity & currency
const APP_NAME = 'Stat';
const DEFAULT_CURRENCY = 'EUR';
let currentCurrency = DEFAULT_CURRENCY;

function getCurrentCurrency() {
    return currentCurrency;
}

// Global state
let currentMode = 'personal'; // 'personal' or 'business'
let currentTab = 'transactions';
let currentFilters = {
    dateFrom: '',
    dateTo: '',
    type: 'all',
    category: 'all'
};
let categories = { income: [], expense: [] };
let editingTransaction = null;

// DOM Elements
const modeBtns = document.querySelectorAll('.mode-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabs = document.querySelectorAll('.tab-content');
const transactionsList = document.getElementById('transactionsList');
const filterDateFrom = document.getElementById('filterDateFrom');
const filterDateTo = document.getElementById('filterDateTo');
const filterType = document.getElementById('filterType');
const filterCategory = document.getElementById('filterCategory');
const clearFiltersBtn = document.getElementById('clearFilters');
const addTransactionBtn = document.getElementById('addTransactionBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const backupBtn = document.getElementById('backupBtn');
const restoreBtn = document.getElementById('restoreBtn');
const restoreFileInput = document.getElementById('restoreFileInput');
const clearAllDataBtn = document.getElementById('clearAllDataBtn');
const fileInput = document.getElementById('fileInput');
const importBtn = document.getElementById('importBtn');
const importPreview = document.getElementById('importPreview');
const statsYear = document.getElementById('statsYear');
const refreshStatsBtn = document.getElementById('refreshStats');
const monthlyStatsDiv = document.getElementById('monthlyStats');
const categoryStatsDiv = document.getElementById('categoryStats');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const newCategoryName = document.getElementById('newCategoryName');
const newCategoryType = document.getElementById('newCategoryType');
const categoriesList = document.getElementById('categoriesList');

// Modal elements
const modal = document.getElementById('transactionModal');
const modalTitle = document.getElementById('modalTitle');
const transactionForm = document.getElementById('transactionForm');
const transactionId = document.getElementById('transactionId');
const transactionDate = document.getElementById('transactionDate');
const transactionType = document.getElementById('transactionType');
const transactionAmount = document.getElementById('transactionAmount');
const transactionCategory = document.getElementById('transactionCategory');
const transactionDescription = document.getElementById('transactionDescription');
const deleteTransactionBtn = document.getElementById('deleteTransactionBtn');
const closeModal = document.querySelector('.close');
const cancelModalBtn = document.getElementById('cancelModalBtn');

// Populate stats year dropdown dynamically
async function populateStatsYears() {
    const all = await getTransactions({});
    const years = [...new Set(
        all
            .map(t => String(t.date || '').slice(0, 4))
            .filter(Boolean)
    )].sort((a, b) => b.localeCompare(a));

    const currentYear = String(new Date().getFullYear());
    if (!years.includes(currentYear)) years.unshift(currentYear);

    statsYear.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    statsYear.value = currentYear;
}

// Initialize app
async function init() {
    // Open database and init categories
    await openDB();
    await initCategories();
    await loadCategories();
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    filterDateFrom.value = firstDayOfMonth;
    filterDateTo.value = today;
    currentFilters.dateFrom = firstDayOfMonth;
    currentFilters.dateTo = today;
    
    // Set current year in stats dropdown dynamically
    await populateStatsYears();
    
    // Load data
    await loadTransactions();
    await updateStatsSummary();
    await loadMonthlyStats();
    await loadCategoryStats();
    await loadCategoriesList();
    
    // Setup event listeners
    setupEventListeners();
}

// Load categories
async function loadCategories() {
    const allCategories = await getCategories();
    categories = {
        income: allCategories.filter(c => c.type === 'income'),
        expense: allCategories.filter(c => c.type === 'expense')
    };
    
    // Update category filter dropdown
    const allCats = [...categories.income, ...categories.expense];
    filterCategory.innerHTML = '<option value="all">All</option>' + 
        allCats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    
    // Update transaction form category dropdown
    updateCategoryDropdown();
}

// Update category dropdown based on selected type
function updateCategoryDropdown() {
    const type = transactionType.value;
    const cats = type === 'income' ? categories.income : categories.expense;
    transactionCategory.innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

// Load transactions
async function loadTransactions() {
    const filters = {
        accountType: currentMode,
        ...currentFilters
    };
    
    const transactions = await getTransactions(filters);
    displayTransactions(transactions);
}

// Display transactions
function displayTransactions(transactions) {
    if (transactions.length === 0) {
        transactionsList.innerHTML = '<div class="empty-state">📭 No transactions</div>';
        return;
    }
    
    transactionsList.innerHTML = transactions.map(t => `
        <div class="transaction-item" data-id="${t.id}">
            <div class="transaction-info">
                <div>
                    <strong>${formatAmount(t.amount)}</strong>
                    <span class="transaction-category">${escapeHtml(t.category)}</span>
                </div>
                <div class="transaction-date">${formatDate(t.date)}</div>
                ${t.description ? `<div class="transaction-description">${escapeHtml(t.description)}</div>` : ''}
            </div>
            <div class="transaction-amount ${t.type}">
                ${t.type === 'income' ? '+' : '-'} ${formatAmount(t.amount)}
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.transaction-item').forEach(el => {
        el.addEventListener('click', () => editTransaction(transactions.find(t => t.id === el.dataset.id)));
    });
}

// Edit transaction
function editTransaction(transaction) {
    editingTransaction = transaction;
    modalTitle.textContent = 'Edit Transaction';
    transactionId.value = transaction.id;
    transactionDate.value = transaction.date;
    transactionType.value = transaction.type;
    transactionAmount.value = transaction.amount;
    transactionDescription.value = transaction.description || '';
    updateCategoryDropdown();
    transactionCategory.value = transaction.category;
    deleteTransactionBtn.style.display = 'block';
    modal.style.display = 'flex';
}

// Update stats summary (balance, income, expense)
async function updateStatsSummary() {
    const stats = await getStats(currentMode, null);
    document.getElementById('balanceAmount').textContent = formatAmount(stats.balance);
    document.getElementById('incomeAmount').textContent = formatAmount(stats.income);
    document.getElementById('expenseAmount').textContent = formatAmount(stats.expense);
}

// Load monthly stats
async function loadMonthlyStats() {
    const year = statsYear.value;
    const monthlyStats = await getMonthlyStats(currentMode, year);
    
    monthlyStatsDiv.innerHTML = monthlyStats.map(m => `
        <div class="month-card">
            <div class="month-name">${getMonthName(m.month)}</div>
            <div class="month-income">📈 Income: ${formatAmount(m.income)}</div>
            <div class="month-expense">📉 Expense: ${formatAmount(m.expense)}</div>
            <div class="month-balance">💰 Balance: ${formatAmount(m.balance)}</div>
        </div>
    `).join('');
}

// Load category stats
async function loadCategoryStats() {
    const stats = await getStats(currentMode, null);
    const categories = Object.entries(stats.categoryBreakdown);
    
    if (categories.length === 0) {
        categoryStatsDiv.innerHTML = '<div class="empty-state">No data available</div>';
        return;
    }
    
    categoryStatsDiv.innerHTML = `
        <h3>📊 By Category</h3>
        ${categories.map(([cat, data]) => `
            <div class="category-item">
                <span>${cat}</span>
                <span style="color: #10b981;">+${formatAmount(data.income)}</span>
                <span style="color: #ef4444;">-${formatAmount(data.expense)}</span>
            </div>
        `).join('')}
    `;
}

// Load categories list for settings
async function loadCategoriesList() {
    const allCategories = await getCategories();
    
    categoriesList.innerHTML = `
        <div class="category-group">
            <h4>📈 Income</h4>
            ${allCategories.filter(c => c.type === 'income').map(c => `
                <div class="category-item">
                    <span>${c.name}</span>
                    <button class="btn-secondary delete-cat" data-id="${c.id}" style="padding: 4px 12px;">Delete</button>
                </div>
            `).join('')}
        </div>
        <div class="category-group">
            <h4>📉 Expense</h4>
            ${allCategories.filter(c => c.type === 'expense').map(c => `
                <div class="category-item">
                    <span>${c.name}</span>
                    <button class="btn-secondary delete-cat" data-id="${c.id}" style="padding: 4px 12px;">Delete</button>
                </div>
            `).join('')}
        </div>
    `;
    
    document.querySelectorAll('.delete-cat').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (confirm('Are you sure you want to delete this category?')) {
                await deleteCategory(id);
                await loadCategories();
                await loadCategoriesList();
                await loadTransactions();
                await updateStatsSummary();
            }
        });
    });
}

// Normalize date to YYYY-MM-DD
function normalizeDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d)) return '';
    return d.toISOString().split('T')[0];
}

// Detect category from description
function detectCategory(description, type) {
    const text = String(description || '').toLowerCase();

    if (type === 'expense') {
        if (text.includes('uber') || text.includes('taxi') || text.includes('fuel')) return 'Transport';
        if (text.includes('netflix') || text.includes('spotify') || text.includes('cinema')) return 'Entertainment';
        if (text.includes('pharmacy') || text.includes('doctor')) return 'Health';
        if (text.includes('market') || text.includes('lidl') || text.includes('aldi')) return 'Food';
    }

    if (type === 'income') {
        if (text.includes('salary') || text.includes('payroll')) return 'Salary';
        if (text.includes('invoice') || text.includes('client')) return 'Freelance';
    }

    return 'Other';
}

// Map imported row (supports Revolut and standard CSV formats)
// Map imported row (supports Revolut and standard CSV formats)
function mapImportedRow(row, forcedAccountType = null) {
    const keys = Object.keys(row).reduce((acc, key) => {
        acc[key.toLowerCase().trim()] = row[key];
        return acc;
    }, {});

    const rawDate =
        keys['date'] ||
        keys['started date'] ||
        keys['completed date'] ||
        '';

    const rawAmount =
        keys['amount'] ||
        keys['paid in (account cc y)'] ||
        keys['paid out (account cc y)'] ||
        0;

    const rawDescription =
        keys['description'] ||
        keys['reference'] ||
        keys['notes'] ||
        keys['type'] ||
        '';

    let amount = parseFloat(String(rawAmount).replace(',', '.').replace(/[^\d.-]/g, '')) || 0;

    let type = 'expense';
    if (amount > 0) type = 'income';
    if (keys['paid out (account cc y)']) type = 'expense';
    if (keys['paid in (account cc y)']) type = 'income';

    amount = Math.abs(amount);

    const description = String(rawDescription || '').trim();

    return {
        date: normalizeDate(rawDate),
        type,
        amount,
        category: detectCategory(description, type),
        description,
        accountType: forcedAccountType !== null ? forcedAccountType : currentMode
    };
}

// CSV Import
function importCSV(file) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            console.log('📄 CSV parsed rows:', results.data.length);
            if (results.data.length > 0) {
                console.log('📋 CSV headers:', Object.keys(results.data[0]));
                console.log('📋 CSV sample row:', results.data[0]);
            }

            const transactions = results.data
                .map(row => mapImportedRow(row, currentMode))
                .filter(t => t.date && !isNaN(t.amount) && t.amount > 0);

            console.log('✅ Mapped transactions:', transactions.length);
            if (transactions.length > 0) {
                console.log('✅ Sample mapped:', transactions[0]);
            }

            if (transactions.length === 0) {
                alert('No valid transactions found in file. Make sure file has columns: date, amount (and optional: type, category, description)');
                return;
            }

            for (const t of transactions) {
                await addTransaction(t);
            }

            await loadTransactions();
            await updateStatsSummary();
            await loadMonthlyStats();
            await loadCategoryStats();
            await populateStatsYears();

            alert(`✅ Successfully imported ${transactions.length} transactions`);
            importPreview.innerHTML = '';
            fileInput.value = '';
            importBtn.disabled = true;
        },
        error: (error) => {
            console.error('❌ CSV parse error:', error);
            alert('Error parsing CSV: ' + error.message);
        }
    });
}

function importExcel(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet);

            console.log('📄 Excel parsed rows:', rows.length);
            if (rows.length > 0) {
                console.log('📋 Excel headers:', Object.keys(rows[0]));
                console.log('📋 Excel sample row:', rows[0]);
            }

            const transactions = rows
                .map(row => mapImportedRow(row, currentMode))
                .filter(t => t.date && !isNaN(t.amount) && t.amount > 0);

            console.log('✅ Mapped transactions:', transactions.length);
            if (transactions.length > 0) {
                console.log('✅ Sample mapped:', transactions[0]);
            }

            if (transactions.length === 0) {
                alert('No valid transactions found in file. Make sure file has columns: date, amount (and optional: type, category, description)');
                return;
            }

            for (const t of transactions) {
                await addTransaction(t);
            }

            await loadTransactions();
            await updateStatsSummary();
            await loadMonthlyStats();
            await loadCategoryStats();
            await populateStatsYears();

            alert(`✅ Successfully imported ${transactions.length} transactions`);
            importPreview.innerHTML = '';
            fileInput.value = '';
            importBtn.disabled = true;
        } catch (error) {
            console.error('❌ Excel parse error:', error);
            alert('Error parsing Excel file: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// Preview file before import
function previewFile(file) {
    if (!file) return;
    
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'csv') {
        Papa.parse(file, {
            header: true,
            preview: 5,
            complete: (results) => {
                displayPreview(results.data);
            }
        });
    } else if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet);
            displayPreview(rows.slice(0, 5));
        };
        reader.readAsArrayBuffer(file);
    }
}

function displayPreview(rows) {
    if (rows.length === 0) {
        importPreview.innerHTML = '<p>No data in file</p>';
        return;
    }

    const headers = Object.keys(rows[0]);

    // Add header info
    importPreview.innerHTML = `
        <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            <strong>📋 Detected columns:</strong> ${headers.join(', ')}
        </div>
    `;

    importPreview.innerHTML += `
        <h4>Preview (first 5 records):</h4>
        <table class="preview-table">
            <thead>
                <tr>
                    ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        ${headers.map(h => `<td>${escapeHtml(String(row[h] || ''))}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <p><strong>ℹ️ Info:</strong> Stat supports standard CSV and Revolut-like CSV files</p>
        <p><strong>📌 Required columns:</strong> date, amount (or "Paid In"/"Paid Out" for Revolut)</p>
    `;

    const sample = rows.slice(0, 2).map(row => mapImportedRow(row, currentMode));

    if (sample.length > 0 && sample[0].date) {
        importPreview.innerHTML += `
            <h4>📋 Will be imported as:</h4>
            <table class="preview-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Category</th>
                    </tr>
                </thead>
                <tbody>
                    ${sample.map(t => `
                        <tr>
                            <td>${escapeHtml(t.date)}</td>
                            <td>${escapeHtml(t.type)}</td>
                            <td>${escapeHtml(String(t.amount))}</td>
                            <td>${escapeHtml(t.category)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

// Export to JSON
async function exportToJSON() {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stat_backup_${currentMode}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Setup event listeners
function setupEventListeners() {
    // Debug: check if import elements exist
    console.log('Import button element:', importBtn);
    console.log('File input element:', fileInput);

    // Mode switch
    modeBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            await loadTransactions();
            await updateStatsSummary();
            await loadMonthlyStats();
            await loadCategoryStats();
        });
    });
    
    // Tab switch
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabs.forEach(tab => tab.classList.remove('active'));
            document.getElementById(`${btn.dataset.tab}Tab`).classList.add('active');
            currentTab = btn.dataset.tab;
        });
    });
    
    // Filters
    filterDateFrom.addEventListener('change', (e) => {
        currentFilters.dateFrom = e.target.value;
        loadTransactions();
    });
    filterDateTo.addEventListener('change', (e) => {
        currentFilters.dateTo = e.target.value;
        loadTransactions();
    });
    filterType.addEventListener('change', (e) => {
        currentFilters.type = e.target.value;
        loadTransactions();
    });
    filterCategory.addEventListener('change', (e) => {
        currentFilters.category = e.target.value;
        loadTransactions();
    });
    clearFiltersBtn.addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        filterDateFrom.value = firstDayOfMonth;
        filterDateTo.value = today;
        filterType.value = 'all';
        filterCategory.value = 'all';
        currentFilters = {
            dateFrom: firstDayOfMonth,
            dateTo: today,
            type: 'all',
            category: 'all'
        };
        loadTransactions();
    });
    
    // Add transaction
    addTransactionBtn.addEventListener('click', () => {
        editingTransaction = null;
        modalTitle.textContent = 'New Transaction';
        transactionId.value = '';
        transactionDate.value = new Date().toISOString().split('T')[0];
        transactionType.value = 'expense';
        transactionAmount.value = '';
        transactionDescription.value = '';
        updateCategoryDropdown();
        transactionCategory.value = categories.expense[0]?.name || '';
        deleteTransactionBtn.style.display = 'none';
        modal.style.display = 'flex';
    });
    
    // Transaction form submit
    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const transaction = {
            id: transactionId.value || undefined,
            date: transactionDate.value,
            type: transactionType.value,
            amount: parseFloat(transactionAmount.value),
            category: transactionCategory.value,
            description: transactionDescription.value,
            accountType: currentMode
        };
        
        if (transaction.id) {
            await updateTransaction(transaction);
        } else {
            await addTransaction(transaction);
        }
        
        await loadTransactions();
        await updateStatsSummary();
        await loadMonthlyStats();
        await loadCategoryStats();
        
        modal.style.display = 'none';
        transactionForm.reset();
    });
    
    // Delete transaction
    deleteTransactionBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this transaction?')) {
            await deleteTransaction(transactionId.value);
            await loadTransactions();
            await updateStatsSummary();
            await loadMonthlyStats();
            await loadCategoryStats();
            modal.style.display = 'none';
        }
    });
    
    // Close modal
    closeModal.addEventListener('click', () => modal.style.display = 'none');
    cancelModalBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
    
    // Transaction type change - update categories
    transactionType.addEventListener('change', updateCategoryDropdown);
    
    // Export JSON
    exportJsonBtn.addEventListener('click', exportToJSON);
    backupBtn.addEventListener('click', exportToJSON);
    
    // Restore from backup
    restoreBtn.addEventListener('click', () => restoreFileInput.click());
    restoreFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                await importData(data);
                await loadCategories();
                await loadTransactions();
                await updateStatsSummary();
                await loadMonthlyStats();
                await loadCategoryStats();
                await loadCategoriesList();
                await populateStatsYears();
                alert('Data restored successfully');
            } catch (error) {
                alert('Invalid file format');
            }
        };
        reader.readAsText(file);
        restoreFileInput.value = '';
    });
    
    // Clear all data
    clearAllDataBtn.addEventListener('click', async () => {
        if (confirm('⚠️ This will delete ALL data! Are you sure?')) {
            await clearAllData();
            await loadCategories();
            await loadTransactions();
            await updateStatsSummary();
            await loadMonthlyStats();
            await loadCategoryStats();
            await loadCategoriesList();
            await populateStatsYears();
            alert('All data has been deleted');
        }
    });
    
    // File import
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        console.log('File selected:', file ? file.name : 'none');
        if (file) {
            previewFile(file);
            importBtn.disabled = false;
            console.log('Import button enabled');
        } else {
            importBtn.disabled = true;
            console.log('Import button disabled');
        }
    });

    importBtn.addEventListener('click', () => {
        const file = fileInput.files[0];
        console.log('Import button clicked, file:', file ? file.name : 'none');
        if (!file) {
            alert('Please select a file first');
            return;
        }

        const ext = file.name.split('.').pop().toLowerCase();
        console.log('File extension:', ext);
        if (ext === 'csv') {
            importCSV(file);
        } else if (ext === 'xlsx' || ext === 'xls') {
            importExcel(file);
        } else {
            alert('Supported formats: CSV, Excel');
        }
    });
    
    // Stats refresh
    refreshStatsBtn.addEventListener('click', async () => {
        await loadMonthlyStats();
        await loadCategoryStats();
    });
    
    // Add category
    addCategoryBtn.addEventListener('click', async () => {
        const name = newCategoryName.value.trim();
        const type = newCategoryType.value;
        
        if (!name) {
            alert('Please enter a category name');
            return;
        }
        
        await addCategory(name, type);
        await loadCategories();
        await loadCategoriesList();
        await loadTransactions();
        
        newCategoryName.value = '';
    });
}

// Helper functions
function formatAmount(amount) {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: getCurrentCurrency()
    }).format(amount || 0);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US');
}

function getMonthName(month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Start app
init();