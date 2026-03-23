// App identity & currency
const APP_NAME = 'Stat';
const DEFAULT_CURRENCY = 'EUR';
let currentCurrency = DEFAULT_CURRENCY;

function getCurrentCurrency() {
    return currentCurrency;
}

// Global state
let currentMode = 'personal';
let currentBank = 'all';
let currentTab = 'stats';
let currentFilters = {
    dateFrom: '',
    dateTo: '',
    type: 'all',
    category: 'all',
    search: ''
};
let categories = { income: [], expense: [] };
let banksCache = [];
let editingTransaction = null;
let isStatsPanelCollapsed = false;
let touchStartX = 0;
let touchEndX = 0;

// DOM Elements
const modeBtns = document.querySelectorAll('.mode-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabs = document.querySelectorAll('.tab-content');
const transactionsList = document.getElementById('transactionsList');
const filterDateFrom = document.getElementById('filterDateFrom');
const filterDateTo = document.getElementById('filterDateTo');
const filterType = document.getElementById('filterType');
const filterCategory = document.getElementById('filterCategory');
const filterSearch = document.getElementById('filterSearch');
const clearFiltersBtn = document.getElementById('clearFilters');
const addTransactionBtn = document.getElementById('addTransactionBtn');
const backupBtn = document.getElementById('backupBtn');
const restoreBtn = document.getElementById('restoreBtn');
const restoreFileInput = document.getElementById('restoreFileInput');
const clearAllDataBtn = document.getElementById('clearAllDataBtn');
const fileInput = document.getElementById('fileInput');
const importBtn = document.getElementById('importBtn');
const importPreview = document.getElementById('importPreview');
const importResult = document.getElementById('importResult');
const importInfo = document.getElementById('importInfo');
const statsYear = document.getElementById('statsYear');
const monthlyStatsDiv = document.getElementById('monthlyStats');
const categoryStatsDiv = document.getElementById('categoryStats');
const statsPanel = document.getElementById('statsPanel');
const statsPanelToggle = document.getElementById('statsPanelToggle');
const statsPanelBody = document.getElementById('statsPanelBody');
const statsPanelArrow = document.getElementById('statsPanelArrow');
const prevYearBtn = document.getElementById('prevYearBtn');
const nextYearBtn = document.getElementById('nextYearBtn');
const statsSwipeArea = document.getElementById('statsSwipeArea');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const newCategoryName = document.getElementById('newCategoryName');
const newCategoryType = document.getElementById('newCategoryType');
const categoriesList = document.getElementById('categoriesList');
const banksList = document.getElementById('banksList');
const newBankName = document.getElementById('newBankName');
const addBankBtn = document.getElementById('addBankBtn');
const bankSelect = document.getElementById('bankSelect');
const overviewThisMonth = document.getElementById('overviewThisMonth');
const overviewLastMonth = document.getElementById('overviewLastMonth');
const overviewSelectedYear = document.getElementById('overviewSelectedYear');
const overviewTxCount = document.getElementById('overviewTxCount');

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
const transactionBank = document.getElementById('transactionBank');
const deleteTransactionBtn = document.getElementById('deleteTransactionBtn');
const closeModal = document.querySelector('.close');
const cancelModalBtn = document.getElementById('cancelModalBtn');

// ─── Banks cache ───────────────────────────────────────────────

async function refreshBanksCache() {
    banksCache = await getBanks();
}

function getBankName(id) {
    if (!id) return '';
    const b = banksCache.find(b => b.id === id);
    return b ? b.name : '';
}

// ─── Stats year dropdown (mode + bank aware) ───────────────────

async function populateStatsYears() {
    const filtered = await getTransactions({
        accountType: currentMode,
        bank: currentBank
    });
    const years = [...new Set(
        filtered.map(t => String(t.date || '').slice(0, 4)).filter(Boolean)
    )].sort((a, b) => b.localeCompare(a));

    const currentYear = String(new Date().getFullYear());
    if (!years.includes(currentYear)) years.unshift(currentYear);

    const prevYear = statsYear.value;
    statsYear.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    statsYear.value = years.includes(prevYear) ? prevYear : currentYear;
}

// ─── Stats panel ───────────────────────────────────────────────

function updateStatsPanelState() {
    statsPanelBody.style.display = isStatsPanelCollapsed ? 'none' : 'block';
    statsPanelArrow.textContent = isStatsPanelCollapsed ? '▸' : '▾';
    statsPanel.classList.toggle('collapsed', isStatsPanelCollapsed);
}

function toggleStatsPanel() {
    isStatsPanelCollapsed = !isStatsPanelCollapsed;
    updateStatsPanelState();
}

async function changeStatsYear(step) {
    const options = [...statsYear.options].map(o => o.value);
    const currentIndex = options.indexOf(statsYear.value);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + step;
    if (nextIndex < 0 || nextIndex >= options.length) return;
    statsYear.value = options[nextIndex];
    await updateStatsSummary();
    await loadOverviewCards();
    await loadMonthlyStats();
    await loadCategoryStats();
}

function setupStatsSwipe() {
    if (!statsSwipeArea) return;
    statsSwipeArea.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    statsSwipeArea.addEventListener('touchend', async (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (Math.abs(diff) < 40) return;
        if (diff < 0) await changeStatsYear(-1);
        else await changeStatsYear(1);
    }, { passive: true });
}

// ─── Helper: refresh all stats (year list first, then data) ────

async function refreshAllStats() {
    await populateStatsYears();
    await updateStatsSummary();
    await loadOverviewCards();
    await loadMonthlyStats();
    await loadCategoryStats();
}

// ─── Init ──────────────────────────────────────────────────────

async function init() {
    await openDB();
    await initCategories();
    await loadCategories();
    await refreshBanksCache();
    await populateBankSelectors();

    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    filterDateFrom.value = firstDayOfMonth;
    filterDateTo.value = today;
    currentFilters.dateFrom = firstDayOfMonth;
    currentFilters.dateTo = today;
    currentFilters.search = '';

    await loadTransactions();
    await refreshAllStats();
    await loadCategoriesList();
    await loadBanksList();

    setupEventListeners();
    updateStatsPanelState();
    setupStatsSwipe();
}

// ─── Categories ────────────────────────────────────────────────

async function loadCategories() {
    const allCategories = await getCategories();
    categories = {
        income: allCategories.filter(c => c.type === 'income'),
        expense: allCategories.filter(c => c.type === 'expense')
    };
    const allCats = [...categories.income, ...categories.expense];
    filterCategory.innerHTML = '<option value="all">All</option>' +
        allCats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    updateCategoryDropdown();
}

function updateCategoryDropdown() {
    const type = transactionType.value;
    const cats = (type === 'income' ? categories.income : categories.expense)
        .filter(c => !c.archived);

    transactionCategory.innerHTML = cats.map(c => `
        <option value="${c.name}">${c.name}${c.isDefault ? ' • Default' : ''}</option>
    `).join('');
}

// ─── Transactions ──────────────────────────────────────────────

async function loadTransactions() {
    const filters = {
        accountType: currentMode,
        bank: currentBank,
        ...currentFilters
    };
    const transactions = await getTransactions(filters);
    displayTransactions(transactions);
}

function displayTransactions(transactions) {
    if (transactions.length === 0) {
        transactionsList.innerHTML = '<div class="empty-state">📭 No transactions</div>';
        return;
    }
    transactionsList.innerHTML = transactions.map(t => {
        const bankName = getBankName(t.bank);
        return `
        <div class="transaction-item" data-id="${t.id}">
            <div class="transaction-info">
                <div>
                    <strong>${formatAmount(t.amount)}</strong>
                    <span class="transaction-category">${escapeHtml(t.category)}</span>
                    ${bankName ? `<span class="transaction-bank-badge">${escapeHtml(bankName)}</span>` : ''}
                </div>
                <div class="transaction-date">${formatDate(t.date)}</div>
                ${t.description ? `<div class="transaction-description">${escapeHtml(t.description)}</div>` : ''}
            </div>
            <div class="transaction-amount ${t.type}">
                ${t.type === 'income' ? '+' : '-'} ${formatAmount(t.amount)}
            </div>
        </div>`;
    }).join('');

    document.querySelectorAll('.transaction-item').forEach(el => {
        el.addEventListener('click', () => editTransaction(transactions.find(t => t.id === el.dataset.id)));
    });
}

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
    transactionBank.value = transaction.bank || banksCache[0]?.id || '';
    deleteTransactionBtn.style.display = 'block';
    modal.style.display = 'flex';
}

// ─── Stats ─────────────────────────────────────────────────────

async function updateStatsSummary() {
    const selectedYear = statsYear?.value || null;
    const stats = await getStats(currentMode, selectedYear, currentBank);
    document.getElementById('balanceAmount').textContent = formatAmount(stats.balance);
    document.getElementById('incomeAmount').textContent = formatAmount(stats.income);
    document.getElementById('expenseAmount').textContent = formatAmount(stats.expense);
}

async function loadOverviewCards() {
    const now = new Date();
    const currentYear = String(now.getFullYear());
    const currentMonth = now.getMonth() + 1;

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthYear = String(lastMonthDate.getFullYear());
    const lastMonth = lastMonthDate.getMonth() + 1;

    const selectedYear = statsYear?.value || currentYear;

    const thisMonthStats = await getStats(currentMode, currentYear, currentBank, currentMonth);
    const lastMonthStats = await getStats(currentMode, lastMonthYear, currentBank, lastMonth);
    const yearStats = await getStats(currentMode, selectedYear, currentBank);

    overviewThisMonth.textContent = formatAmount(thisMonthStats.balance);
    overviewLastMonth.textContent = formatAmount(lastMonthStats.balance);
    overviewSelectedYear.textContent = formatAmount(yearStats.balance);
    overviewTxCount.textContent = String(yearStats.total || 0);
}

async function loadMonthlyStats() {
    const year = statsYear.value;
    const monthlyStats = await getMonthlyStats(currentMode, year, currentBank);

    monthlyStatsDiv.innerHTML = monthlyStats.map(m => {
        const avgTransaction = m.total ? (m.income + m.expense) / m.total : 0;
        const savingsRate = m.income > 0 ? ((m.balance / m.income) * 100) : 0;
        const statusText = m.balance > 0 ? 'Positive' : m.balance < 0 ? 'Negative' : 'Neutral';
        return `
            <div class="month-card">
                <button class="month-card-toggle" type="button">
                    <div class="month-card-head">
                        <div class="month-name">${getMonthName(m.month)}</div>
                        <div class="month-balance-inline">${formatAmount(m.balance)}</div>
                    </div>
                    <div class="month-summary-lines">
                        <div class="month-income">📈 Income: ${formatAmount(m.income)}</div>
                        <div class="month-expense">📉 Expense: ${formatAmount(m.expense)}</div>
                        <div class="month-balance">💰 Balance: ${formatAmount(m.balance)}</div>
                    </div>
                    <span class="month-arrow">▾</span>
                </button>
                <div class="month-card-details">
                    <div class="month-detail-row"><span>Transactions</span><strong>${m.total}</strong></div>
                    <div class="month-detail-row"><span>Average transaction</span><strong>${formatAmount(avgTransaction)}</strong></div>
                    <div class="month-detail-row"><span>Savings rate</span><strong>${savingsRate.toFixed(1)}%</strong></div>
                    <div class="month-detail-row"><span>Status</span><strong>${statusText}</strong></div>
                </div>
            </div>`;
    }).join('');

    document.querySelectorAll('.month-card-toggle').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.month-card').classList.toggle('open'));
    });
}

async function loadCategoryStats() {
    const selectedYear = statsYear?.value || null;
    const stats = await getStats(currentMode, selectedYear, currentBank);
    const cats = Object.entries(stats.categoryBreakdown);

    if (cats.length === 0) {
        categoryStatsDiv.innerHTML = '<div class="empty-state">No data available</div>';
        return;
    }
    categoryStatsDiv.innerHTML = `
        <h3>📊 By Category</h3>
        ${cats.map(([cat, data]) => `
            <div class="category-item">
                <span>${cat}</span>
                <span style="color:#10b981;">+${formatAmount(data.income)}</span>
                <span style="color:#ef4444;">-${formatAmount(data.expense)}</span>
            </div>`).join('')}`;
}

// ─── Categories list (Settings) ────────────────────────────────

async function loadCategoriesList() {
    const allCategories = await getCategories();

    categoriesList.innerHTML = `
        <div class="category-group">
            <h4>📈 Income</h4>
            ${allCategories.filter(c => c.type === 'income').map(c => `
                <div class="category-item ${c.archived ? 'archived' : ''}">
                    <div class="category-main">
                        <span class="category-name">
                            ${escapeHtml(c.name)}
                            ${c.isDefault ? '<span class="category-badge default">Default</span>' : ''}
                            ${c.archived ? '<span class="category-badge archived">Archived</span>' : ''}
                        </span>
                    </div>

                    <div class="category-actions">
                        <button class="btn-secondary category-rename-btn" data-id="${c.id}">✏️ Rename</button>
                        <button class="btn-secondary category-default-btn" data-id="${c.id}">⭐ Default</button>
                        <button class="btn-secondary category-archive-btn" data-id="${c.id}">
                            ${c.archived ? '♻️ Unarchive' : '📦 Archive'}
                        </button>
                        <button class="btn-danger category-delete-btn" data-id="${c.id}">🗑️ Delete</button>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="category-group">
            <h4>📉 Expense</h4>
            ${allCategories.filter(c => c.type === 'expense').map(c => `
                <div class="category-item ${c.archived ? 'archived' : ''}">
                    <div class="category-main">
                        <span class="category-name">
                            ${escapeHtml(c.name)}
                            ${c.isDefault ? '<span class="category-badge default">Default</span>' : ''}
                            ${c.archived ? '<span class="category-badge archived">Archived</span>' : ''}
                        </span>
                    </div>

                    <div class="category-actions">
                        <button class="btn-secondary category-rename-btn" data-id="${c.id}">✏️ Rename</button>
                        <button class="btn-secondary category-default-btn" data-id="${c.id}">⭐ Default</button>
                        <button class="btn-secondary category-archive-btn" data-id="${c.id}">
                            ${c.archived ? '♻️ Unarchive' : '📦 Archive'}
                        </button>
                        <button class="btn-danger category-delete-btn" data-id="${c.id}">🗑️ Delete</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    document.querySelectorAll('.category-rename-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const category = await getCategoryById(id);
            if (!category) return;

            const newName = prompt('Enter new category name:', category.name);
            if (!newName || !newName.trim()) return;

            await updateCategory(id, { name: newName.trim() });
            await loadCategories();
            await loadCategoriesList();
            await loadTransactions();
            await updateStatsSummary();
            await loadMonthlyStats();
            await loadCategoryStats();
        });
    });

    document.querySelectorAll('.category-default-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            await setDefaultCategory(id);
            await loadCategories();
            await loadCategoriesList();
            updateCategoryDropdown();
        });
    });

    document.querySelectorAll('.category-archive-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const category = await getCategoryById(id);
            if (!category) return;

            await updateCategory(id, { archived: !category.archived });
            await loadCategories();
            await loadCategoriesList();
            updateCategoryDropdown();
            await loadTransactions();
            await updateStatsSummary();
            await loadMonthlyStats();
            await loadCategoryStats();
        });
    });

    document.querySelectorAll('.category-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const category = await getCategoryById(id);
            if (!category) return;

            if (!confirm(`Delete category "${category.name}"?`)) return;

            try {
                await deleteCategory(id);
                await loadCategories();
                await loadCategoriesList();
                updateCategoryDropdown();
                await loadTransactions();
                await updateStatsSummary();
                await loadMonthlyStats();
                await loadCategoryStats();
            } catch (err) {
                alert(err.message || 'Cannot delete this category');
            }
        });
    });
}

// ─── Banks (Settings + selectors) ─────────────────────────────

async function populateBankSelectors() {
    const activeBanks = banksCache.filter(b => !b.archived);

    bankSelect.innerHTML = `
        <option value="all">All Banks</option>
        ${activeBanks.map(bank => `
            <option value="${bank.id}">${bank.name}${bank.isDefault ? ' • Default' : ''}</option>
        `).join('')}
    `;

    transactionBank.innerHTML = `
        <option value="">— Select bank —</option>
        ${activeBanks.map(bank => `
            <option value="${bank.id}">${bank.name}${bank.isDefault ? ' • Default' : ''}</option>
        `).join('')}
    `;
}

async function loadBanksList() {
    await refreshBanksCache();

    if (!banksCache.length) {
        banksList.innerHTML = '<div class="empty-state">No banks yet</div>';
        return;
    }

    banksList.innerHTML = banksCache.map(bank => `
        <div class="bank-item ${bank.archived ? 'archived' : ''}">
            <div class="bank-main">
                <span class="bank-name">
                    ${escapeHtml(bank.name)}
                    ${bank.isDefault ? '<span class="bank-badge default">Default</span>' : ''}
                    ${bank.archived ? '<span class="bank-badge archived">Archived</span>' : ''}
                </span>
            </div>

            <div class="bank-actions">
                <button class="btn-secondary bank-rename-btn" data-id="${bank.id}">✏️ Rename</button>
                <button class="btn-secondary bank-default-btn" data-id="${bank.id}">
                    ⭐ Default
                </button>
                <button class="btn-secondary bank-archive-btn" data-id="${bank.id}">
                    ${bank.archived ? '♻️ Unarchive' : '📦 Archive'}
                </button>
                <button class="btn-danger bank-delete-btn" data-id="${bank.id}">🗑️ Delete</button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.bank-rename-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const bank = banksCache.find(b => b.id === id);
            if (!bank) return;

            const newName = prompt('Enter new bank name:', bank.name);
            if (!newName || !newName.trim()) return;

            await updateBank(id, { name: newName.trim() });
            await refreshBanksCache();
            await populateBankSelectors();
            await loadBanksList();
        });
    });

    document.querySelectorAll('.bank-default-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            await setDefaultBank(id);
            await refreshBanksCache();
            await populateBankSelectors();
            await loadBanksList();
        });
    });

    document.querySelectorAll('.bank-archive-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const bank = banksCache.find(b => b.id === id);
            if (!bank) return;

            await updateBank(id, { archived: !bank.archived });

            if (currentBank === id && bank.archived === false) {
                currentBank = 'all';
                bankSelect.value = 'all';
            }

            await refreshBanksCache();
            await populateBankSelectors();
            await loadBanksList();
            await populateStatsYears();
            await loadTransactions();
            await updateStatsSummary();
            await loadOverviewCards();
            await loadMonthlyStats();
            await loadCategoryStats();
        });
    });

    document.querySelectorAll('.bank-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const bank = banksCache.find(b => b.id === id);
            if (!bank) return;

            if (!confirm(`Delete bank "${bank.name}"?`)) return;

            try {
                await deleteBank(id);
                if (currentBank === id) {
                    currentBank = 'all';
                    bankSelect.value = 'all';
                }

                await refreshBanksCache();
                await populateBankSelectors();
                await loadBanksList();
                await populateStatsYears();
                await loadTransactions();
                await updateStatsSummary();
                await loadOverviewCards();
                await loadMonthlyStats();
                await loadCategoryStats();
            } catch (err) {
                alert(err.message || 'Cannot delete this bank');
            }
        });
    });
}

// ─── Import helpers ────────────────────────────────────────────

function normalizeDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d)) return '';
    return d.toISOString().split('T')[0];
}

function ensureImportBankSelected() {
    if (currentBank === 'all') {
        alert('Please select a specific bank before importing.');
        return false;
    }
    return true;
}

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

function mapImportedRow(row, forcedAccountType = null) {
    const keys = Object.keys(row).reduce((acc, key) => {
        acc[key.toLowerCase().trim()] = row[key];
        return acc;
    }, {});

    const rawDate = keys['date'] || keys['started date'] || keys['completed date'] || '';
    const rawAmount = keys['amount'] || keys['paid in (account cc y)'] || keys['paid out (account cc y)'] || 0;
    const rawDescription = keys['description'] || keys['reference'] || keys['notes'] || keys['type'] || '';

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
        accountType: forcedAccountType !== null ? forcedAccountType : currentMode,
        bank: window._importBankId || ''
    };
}

async function askImportBank() {
    const banks = await getBanks();
    if (banks.length === 0) {
        alert('Please add at least one bank in Settings before importing.');
        return null;
    }
    if (currentBank !== 'all') return currentBank;

    const options = banks.map((b, i) => `${i + 1}. ${b.name}`).join('\n');
    const input = prompt(`Choose bank for imported transactions:\n${options}\n\nEnter number:`);
    if (!input) return null;
    const idx = parseInt(input) - 1;
    if (isNaN(idx) || idx < 0 || idx >= banks.length) {
        alert('Invalid selection.');
        return null;
    }
    return banks[idx].id;
}

// ─── CSV / Excel import ────────────────────────────────────────

function importCSV(file) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const bankId = await askImportBank();
            if (!bankId) return;
            window._importBankId = bankId;

            const transactions = results.data
                .map(row => mapImportedRow(row, currentMode))
                .filter(t => t.date && !isNaN(t.amount) && t.amount > 0);

            if (transactions.length === 0) {
                alert('No valid transactions found in file.');
                window._importBankId = null;
                return;
            }
            
            let importedCount = 0;
            let duplicateCount = 0;

            for (const t of transactions) {
                const isDuplicate = await isDuplicateTransaction(t);
                if (isDuplicate) {
                    duplicateCount++;
                    continue;
                }
                await addTransaction(t);
                importedCount++;
            }
            
            window._importBankId = null;

            await populateStatsYears();
            await loadTransactions();
            await updateStatsSummary();
            await loadOverviewCards();
            await loadMonthlyStats();
            await loadCategoryStats();

            const selectedBank = banksCache.find(b => b.id === bankId);

importResult.style.display = 'block';
importResult.className = 'import-result';
importResult.innerHTML = `
    <strong>✅ Import completed</strong><br>
    Bank: ${selectedBank ? escapeHtml(selectedBank.name) : 'Unknown'}<br>
    Rows found: ${transactions.length}<br>
    Imported: ${importedCount}<br>
    Duplicates skipped: ${duplicateCount}<br>
    Failed/empty rows: ${transactions.length - importedCount - duplicateCount}
`;

importInfo.textContent = `Last import completed for bank: ${selectedBank ? selectedBank.name : 'Unknown'}`;
            
            alert(`✅ Imported: ${importedCount} | Skipped duplicates: ${duplicateCount}`);
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
            const bankId = await askImportBank();
            if (!bankId) return;
            window._importBankId = bankId;

            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet);

            const transactions = rows
                .map(row => mapImportedRow(row, currentMode))
                .filter(t => t.date && !isNaN(t.amount) && t.amount > 0);

            if (transactions.length === 0) {
                alert('No valid transactions found. Columns needed: date, amount');
                window._importBankId = null;
                return;
            }
            
            let importedCount = 0;
            let duplicateCount = 0;

            for (const t of transactions) {
                const isDuplicate = await isDuplicateTransaction(t);
                if (isDuplicate) {
                    duplicateCount++;
                    continue;
                }
                await addTransaction(t);
                importedCount++;
            }
            
            window._importBankId = null;

            await populateStatsYears();
            await loadTransactions();
            await updateStatsSummary();
            await loadOverviewCards();
            await loadMonthlyStats();
            await loadCategoryStats();

            const selectedBank = banksCache.find(b => b.id === bankId);

importResult.style.display = 'block';
importResult.className = 'import-result';
importResult.innerHTML = `
    <strong>✅ Import completed</strong><br>
    Bank: ${selectedBank ? escapeHtml(selectedBank.name) : 'Unknown'}<br>
    Rows found: ${transactions.length}<br>
    Imported: ${importedCount}<br>
    Duplicates skipped: ${duplicateCount}<br>
    Failed/empty rows: ${transactions.length - importedCount - duplicateCount}
`;

importInfo.textContent = `Last import completed for bank: ${selectedBank ? selectedBank.name : 'Unknown'}`;
            
            alert(`✅ Imported: ${importedCount} | Skipped duplicates: ${duplicateCount}`);
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

// ─── File preview ──────────────────────────────────────────────

function previewFile(file) {
    if (!file) return;
    importResult.style.display = 'none';
    importResult.innerHTML = '';
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
        Papa.parse(file, {
            header: true, preview: 5,
            complete: (results) => displayPreview(results.data)
        });
    } else if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            displayPreview(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]).slice(0, 5));
        };
        reader.readAsArrayBuffer(file);
    }
}

function displayPreview(rows) {
    if (rows.length === 0) { importPreview.innerHTML = '<p>No data in file</p>'; return; }
    const headers = Object.keys(rows[0]);
    importPreview.innerHTML = `
        <div style="background:#f0fdf4;padding:12px;border-radius:8px;margin-bottom:16px;">
            <strong>📋 Detected columns:</strong> ${headers.join(', ')}
        </div>
        <h4>Preview (first 5 records):</h4>
        <table class="preview-table">
            <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</thead>
            <tbody>${rows.map(row => `<tr>${headers.map(h => `<td>${escapeHtml(String(row[h] || ''))}</td>`).join('')}</tr>`).join('')}</tbody>
        }</table>
        <p><strong>ℹ️ Info:</strong> Found ${rows.length} row(s). Import will use the currently selected bank.</p>
        <p><strong>📌 Required columns:</strong> date, amount</p>`;

    const sample = rows.slice(0, 2).map(row => mapImportedRow(row, currentMode));
    if (sample.length > 0 && sample[0].date) {
        importPreview.innerHTML += `
            <h4>📋 Will be imported as:</h4>
            <table class="preview-table">
                <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Category</th></tr></thead>
                <tbody>${sample.map(t => `<tr>
                    <td>${escapeHtml(t.date)}</td>
                    <td>${escapeHtml(t.type)}</td>
                    <td>${escapeHtml(String(t.amount))}</td>
                    <td>${escapeHtml(t.category)}</td>
                </tr>`).join('')}</tbody>
            </table>`;
    }
}

// ─── Export ────────────────────────────────────────────────────

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

// ─── Event listeners ───────────────────────────────────────────

function setupEventListeners() {

    // Mode switch
    modeBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            currentBank = 'all';
            if (bankSelect) bankSelect.value = 'all';
            await populateStatsYears();
            await loadTransactions();
            await updateStatsSummary();
            await loadOverviewCards();
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
    filterDateFrom.addEventListener('change', (e) => { currentFilters.dateFrom = e.target.value; loadTransactions(); });
    filterDateTo.addEventListener('change', (e) => { currentFilters.dateTo = e.target.value; loadTransactions(); });
    filterType.addEventListener('change', (e) => { currentFilters.type = e.target.value; loadTransactions(); });
    filterCategory.addEventListener('change', (e) => { currentFilters.category = e.target.value; loadTransactions(); });
    filterSearch.addEventListener('input', (e) => {
        currentFilters.search = e.target.value.trim();
        loadTransactions();
    });

    clearFiltersBtn.addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        filterDateFrom.value = firstDayOfMonth;
        filterDateTo.value = today;
        filterType.value = 'all';
        filterCategory.value = 'all';
        filterSearch.value = '';
        currentFilters = { dateFrom: firstDayOfMonth, dateTo: today, type: 'all', category: 'all', search: '' };
        loadTransactions();
    });

    // Add transaction modal open
addTransactionBtn.addEventListener('click', async () => {
    editingTransaction = null;
    modalTitle.textContent = 'New Transaction';
    transactionId.value = '';
    transactionDate.value = new Date().toISOString().split('T')[0];
    transactionType.value = 'expense';
    transactionAmount.value = '';
    transactionDescription.value = '';

    updateCategoryDropdown();

    const defaultCategory = categories.expense.find(c => c.isDefault && !c.archived);
    transactionCategory.value =
        defaultCategory?.name ||
        categories.expense.find(c => !c.archived)?.name ||
        '';

    deleteTransactionBtn.style.display = 'none';

    const defaultBank = await getDefaultBank();
    if (currentBank !== 'all') {
        transactionBank.value = currentBank;
    } else if (defaultBank) {
        transactionBank.value = defaultBank.id;
    } else {
        transactionBank.value = '';
    }

    modal.style.display = 'flex';
});

    // Save transaction
    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!transactionBank.value) {
            alert('Please select a bank before saving.');
            transactionBank.focus();
            return;
        }

        const transaction = {
            id: transactionId.value || undefined,
            date: transactionDate.value,
            type: transactionType.value,
            amount: parseFloat(transactionAmount.value),
            category: transactionCategory.value,
            description: transactionDescription.value,
            accountType: currentMode,
            bank: transactionBank.value
        };
        if (transaction.id) await updateTransaction(transaction);
        else await addTransaction(transaction);

        await populateStatsYears();
        await loadTransactions();
        await updateStatsSummary();
        await loadOverviewCards();
        await loadMonthlyStats();
        await loadCategoryStats();
        modal.style.display = 'none';
        transactionForm.reset();
    });

    // Delete transaction
    deleteTransactionBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this transaction?')) {
            await deleteTransaction(transactionId.value);
            await populateStatsYears();
            await loadTransactions();
            await updateStatsSummary();
            await loadOverviewCards();
            await loadMonthlyStats();
            await loadCategoryStats();
            modal.style.display = 'none';
        }
    });

    // Close modal
    closeModal.addEventListener('click', () => modal.style.display = 'none');
    cancelModalBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    // Transaction type change
    transactionType.addEventListener('change', () => {
    updateCategoryDropdown();

    const type = transactionType.value;
    const cats = type === 'income' ? categories.income : categories.expense;
    const defaultCategory = cats.find(c => c.isDefault && !c.archived);
    transactionCategory.value = defaultCategory?.name || cats.find(c => !c.archived)?.name || '';
});

    // Backup
    backupBtn.addEventListener('click', exportToJSON);

    // Restore from backup
    restoreBtn.addEventListener('click', () => restoreFileInput.click());
    fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];

    importResult.style.display = 'none';
    importResult.innerHTML = '';

    if (!file) {
        importPreview.innerHTML = '';
        importInfo.textContent = 'Select a file and make sure a specific bank is selected before importing.';
        importBtn.disabled = true;
        return;
    }

    if (currentBank === 'all') {
        importInfo.textContent = '⚠️ Please choose a specific bank before importing this file.';
    } else {
        const selectedBank = banksCache.find(b => b.id === currentBank);
        importInfo.textContent = `Import target bank: ${selectedBank ? selectedBank.name : 'Unknown bank'}`;
    }

    importBtn.disabled = false;
    await previewFile(file);
});

    // Clear all data
    clearAllDataBtn.addEventListener('click', async () => {
        if (confirm('⚠️ This will delete ALL data! Are you sure?')) {
            await clearAllData();
            currentBank = 'all';
            await loadCategories();
            await populateBankSelectors();
            await loadBanksList();
            await populateStatsYears();
            await loadTransactions();
            await updateStatsSummary();
            await loadOverviewCards();
            await loadMonthlyStats();
            await loadCategoryStats();
            await loadCategoriesList();
            alert('All data has been deleted');
        }
    });

    importBtn.addEventListener('click', () => {
    	if (!ensureImportBankSelected()) return;
        const file = fileInput.files[0];
        if (!file) { alert('Please select a file first'); return; }
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'csv') importCSV(file);
        else if (ext === 'xlsx' || ext === 'xls') importExcel(file);
        else alert('Supported formats: CSV, Excel');
    });

    // Stats year dropdown
    statsYear.addEventListener('change', async () => {
        await updateStatsSummary();
        await loadOverviewCards();
        await loadMonthlyStats();
        await loadCategoryStats();
    });

    // Stats panel toggle
    if (statsPanelToggle) statsPanelToggle.addEventListener('click', toggleStatsPanel);

    // Bank selector (header)
    if (bankSelect) {
    bankSelect.addEventListener('change', async () => {
        currentBank = bankSelect.value;

        if (currentBank === 'all') {
            importInfo.textContent = '⚠️ Please choose a specific bank before importing.';
        } else {
            const selectedBank = banksCache.find(b => b.id === currentBank);
            importInfo.textContent = `Import target bank: ${selectedBank ? selectedBank.name : 'Unknown bank'}`;
        }

        await populateStatsYears();
        await loadTransactions();
        await updateStatsSummary();
        await loadOverviewCards();
        await loadMonthlyStats();
        await loadCategoryStats();
    });
}

    // Year nav buttons
    if (prevYearBtn) prevYearBtn.addEventListener('click', async () => await changeStatsYear(1));
    if (nextYearBtn) nextYearBtn.addEventListener('click', async () => await changeStatsYear(-1));

    // Add bank
    addBankBtn.addEventListener('click', async () => {
        const name = newBankName.value.trim();
        if (!name) { alert('Please enter a bank name'); return; }
        try {
            await addBank(name);
            newBankName.value = '';
            await populateBankSelectors();
            await loadBanksList();
        } catch (err) {
            alert('A bank with this name already exists.');
        }
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

    const sameTypeCategories = await getCategories(type);
    const hasDefault = sameTypeCategories.some(c => c.isDefault && !c.archived);

    if (!hasDefault) {
        const firstActive = sameTypeCategories.find(c => !c.archived);
        if (firstActive) {
            await setDefaultCategory(firstActive.id);
        }
    }

    await loadCategories();
    await loadCategoriesList();
    updateCategoryDropdown();
    await loadTransactions();
    await updateStatsSummary();
    await loadMonthlyStats();
    await loadCategoryStats();

    newCategoryName.value = '';
});
}

// ─── Helpers ───────────────────────────────────────────────────

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

// ─── Start ─────────────────────────────────────────────────────
init();