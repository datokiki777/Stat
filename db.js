// Database configuration
const DB_NAME = 'StatApp';
const DB_VERSION = 2;
const STORE_NAME = 'transactions';
const CATEGORIES_STORE = 'categories';
const BANKS_STORE = 'banks';

// Default categories
const DEFAULT_CATEGORIES = {
    income: ['Salary', 'Freelance', 'Gift', 'Investment', 'Other'],
    expense: ['Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Education', 'Other']
};

let db = null;

// Open database
function openDB() {
    return new Promise((resolve, reject) => {
        if (db && db.name === DB_NAME) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            
            // Transactions store
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('accountType', 'accountType', { unique: false });
                store.createIndex('type', 'type', { unique: false });
                store.createIndex('category', 'category', { unique: false });
                store.createIndex('bank', 'bank', { unique: false });
                store.createIndex('date_accountType', ['date', 'accountType'], { unique: false });
            }
            
            // Categories store
            if (!database.objectStoreNames.contains(CATEGORIES_STORE)) {
                const catStore = database.createObjectStore(CATEGORIES_STORE, { keyPath: 'id' });
                catStore.createIndex('type', 'type', { unique: false });
                catStore.createIndex('name', 'name', { unique: false });
            }

            // Banks store
            if (!database.objectStoreNames.contains(BANKS_STORE)) {
                const bankStore = database.createObjectStore(BANKS_STORE, { keyPath: 'id' });
                bankStore.createIndex('name', 'name', { unique: true });
            }
        };
    });
}

// Initialize default categories
async function initCategories() {
    const db = await openDB();
    const transaction = db.transaction([CATEGORIES_STORE], 'readwrite');
    const store = transaction.objectStore(CATEGORIES_STORE);
    
    // Check if categories exist
    const countRequest = store.count();
    
    return new Promise((resolve) => {
        countRequest.onsuccess = () => {
            if (countRequest.result === 0) {
                // Add default categories
                const categories = [];
                DEFAULT_CATEGORIES.income.forEach(name => {
                    categories.push({
                        id: crypto.randomUUID(),
                        name,
                        type: 'income'
                    });
                });
                DEFAULT_CATEGORIES.expense.forEach(name => {
                    categories.push({
                        id: crypto.randomUUID(),
                        name,
                        type: 'expense'
                    });
                });
                
                categories.forEach(cat => store.add(cat));
                transaction.oncomplete = () => resolve(categories);
            } else {
                resolve(null);
            }
        };
    });
}

// Get all categories
async function getCategories(type = null) {
    const db = await openDB();
    const transaction = db.transaction([CATEGORIES_STORE], 'readonly');
    const store = transaction.objectStore(CATEGORIES_STORE);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            let categories = request.result;

            if (type) {
                categories = categories.filter(c => c.type === type);
            }

            categories.sort((a, b) => {
                if (a.isDefault && !b.isDefault) return -1;
                if (!a.isDefault && b.isDefault) return 1;
                if ((a.archived ? 1 : 0) !== (b.archived ? 1 : 0)) {
                    return (a.archived ? 1 : 0) - (b.archived ? 1 : 0);
                }
                return a.name.localeCompare(b.name);
            });

            resolve(categories);
        };
        request.onerror = () => reject(request.error);
    });
}

// Add category
async function addCategory(name, type) {
    const db = await openDB();
    const transaction = db.transaction([CATEGORIES_STORE], 'readwrite');
    const store = transaction.objectStore(CATEGORIES_STORE);

    const newCategory = {
        id: crypto.randomUUID(),
        name: name.trim(),
        type,
        archived: false,
        isDefault: false,
        createdAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const request = store.add(newCategory);
        request.onsuccess = () => resolve(newCategory);
        request.onerror = () => reject(request.error);
    });
}

// Delete category
async function deleteCategory(id) {
    const category = await getCategoryById(id);
    if (!category) throw new Error('Category not found');

    const linkedTransactions = await getTransactions({});
    const used = linkedTransactions.some(t => t.category === category.name);

    if (used) {
        throw new Error('This category has linked transactions. Archive it instead or change those transactions first.');
    }

    const db = await openDB();
    const transaction = db.transaction([CATEGORIES_STORE], 'readwrite');
    const store = transaction.objectStore(CATEGORIES_STORE);

    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

  async function getCategoryById(id) {
    const db = await openDB();
    const transaction = db.transaction([CATEGORIES_STORE], 'readonly');
    const store = transaction.objectStore(CATEGORIES_STORE);

    return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

async function updateCategory(id, updates) {
    const db = await openDB();
    const transaction = db.transaction([CATEGORIES_STORE], 'readwrite');
    const store = transaction.objectStore(CATEGORIES_STORE);

    return new Promise((resolve, reject) => {
        const getReq = store.get(id);

        getReq.onsuccess = () => {
            const category = getReq.result;
            if (!category) {
                reject(new Error('Category not found'));
                return;
            }

            const updated = { ...category, ...updates };
            const putReq = store.put(updated);

            putReq.onsuccess = () => resolve(updated);
            putReq.onerror = () => reject(putReq.error);
        };

        getReq.onerror = () => reject(getReq.error);
    });
}

async function setDefaultCategory(id) {
    const target = await getCategoryById(id);
    if (!target) throw new Error('Category not found');

    const db = await openDB();
    const transaction = db.transaction([CATEGORIES_STORE], 'readwrite');
    const store = transaction.objectStore(CATEGORIES_STORE);

    return new Promise((resolve, reject) => {
        const req = store.getAll();

        req.onsuccess = () => {
            const categories = req.result;

            categories.forEach(cat => {
                if (cat.type === target.type) {
                    cat.isDefault = cat.id === id;
                    store.put(cat);
                }
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        };

        req.onerror = () => reject(req.error);
    });
}

async function getDefaultCategory(type) {
    const categories = await getCategories(type);
    return categories.find(c => c.isDefault && !c.archived) || null;
}

// ─── Banks ───────────────────────────────────────────────

// Get all banks
async function getBanks() {
    const db = await openDB();
    const tx = db.transaction([BANKS_STORE], 'readonly');
    const store = tx.objectStore(BANKS_STORE);
    return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
            const banks = req.result;
            banks.sort((a, b) => {
                if (a.isDefault && !b.isDefault) return -1;
                if (!a.isDefault && b.isDefault) return 1;
                if ((a.archived ? 1 : 0) !== (b.archived ? 1 : 0)) {
                    return (a.archived ? 1 : 0) - (b.archived ? 1 : 0);
                }
                return a.name.localeCompare(b.name);
            });
            resolve(banks);
        };
        req.onerror = () => reject(req.error);
    });
}

// Add bank
async function addBank(name) {
    const db = await openDB();
    const tx = db.transaction([BANKS_STORE], 'readwrite');
    const store = tx.objectStore(BANKS_STORE);
    const newBank = { 
        id: crypto.randomUUID(), 
        name: name.trim(),
        archived: false,
        isDefault: false,
        createdAt: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
        const req = store.add(newBank);
        req.onsuccess = () => resolve(newBank);
        req.onerror = () => reject(req.error);
    });
}

// Update bank
async function updateBank(id, updates) {
    const db = await openDB();
    const tx = db.transaction([BANKS_STORE], 'readwrite');
    const store = tx.objectStore(BANKS_STORE);

    return new Promise((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const bank = getReq.result;
            if (!bank) {
                reject(new Error('Bank not found'));
                return;
            }

            const updated = { ...bank, ...updates };
            const putReq = store.put(updated);

            putReq.onsuccess = () => resolve(updated);
            putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

// Set default bank
async function setDefaultBank(id) {
    const db = await openDB();
    const tx = db.transaction([BANKS_STORE], 'readwrite');
    const store = tx.objectStore(BANKS_STORE);

    return new Promise((resolve, reject) => {
        const getAllReq = store.getAll();

        getAllReq.onsuccess = () => {
            const banks = getAllReq.result;

            banks.forEach(bank => {
                bank.isDefault = bank.id === id;
                store.put(bank);
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        };

        getAllReq.onerror = () => reject(getAllReq.error);
    });
}

// Get default bank
async function getDefaultBank() {
    const banks = await getBanks();
    return banks.find(b => b.isDefault && !b.archived) || null;
}

// Delete bank — blocked if transactions are linked to it
async function deleteBank(id) {
    const linkedTransactions = await getTransactions({ bank: id });

    if (linkedTransactions.length > 0) {
        throw new Error('This bank has linked transactions. Archive it instead or move/delete those transactions first.');
    }

    const db = await openDB();
    const tx = db.transaction([BANKS_STORE], 'readwrite');
    const store = tx.objectStore(BANKS_STORE);

    return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Add transaction
async function addTransaction(transaction) {
    const db = await openDB();
    const store = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
    
    const newTransaction = {
        ...transaction,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    return new Promise((resolve, reject) => {
        const request = store.add(newTransaction);
        request.onsuccess = () => resolve(newTransaction);
        request.onerror = () => reject(request.error);
    });
}

// Update transaction
async function updateTransaction(transaction) {
    const db = await openDB();
    const store = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
    
    const updatedTransaction = {
        ...transaction,
        updatedAt: Date.now()
    };
    
    return new Promise((resolve, reject) => {
        const request = store.put(updatedTransaction);
        request.onsuccess = () => resolve(updatedTransaction);
        request.onerror = () => reject(request.error);
    });
}

// Delete transaction
async function deleteTransaction(id) {
    const db = await openDB();
    const store = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Get all transactions with filters
async function getTransactions(filters = {}) {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
        let request;

        if (filters.accountType && filters.accountType !== 'all') {
            request = store.index('accountType').getAll(filters.accountType);
        } else {
            request = store.getAll();
        }

        request.onsuccess = () => {
            let transactions = request.result;

            if (filters.dateFrom) {
                transactions = transactions.filter(t => t.date >= filters.dateFrom);
            }
            if (filters.dateTo) {
                transactions = transactions.filter(t => t.date <= filters.dateTo);
            }
            if (filters.type && filters.type !== 'all') {
                transactions = transactions.filter(t => t.type === filters.type);
            }
            if (filters.category && filters.category !== 'all') {
                transactions = transactions.filter(t => t.category === filters.category);
            }
            if (filters.bank && filters.bank !== 'all') {
                transactions = transactions.filter(t => t.bank === filters.bank);
            }
            if (filters.search && filters.search.trim()) {
                const q = filters.search.trim().toLowerCase();
                transactions = transactions.filter(t =>
                    String(t.description || '').toLowerCase().includes(q) ||
                    String(t.category || '').toLowerCase().includes(q) ||
                    String(t.amount || '').toLowerCase().includes(q)
                );
            }

            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            resolve(transactions);
        };

        request.onerror = () => reject(request.error);
    });
}

// Duplicate check helper
async function isDuplicateTransaction(candidate) {
    const transactions = await getTransactions({
        accountType: candidate.accountType,
        bank: candidate.bank
    });

    return transactions.some(t =>
        t.date === candidate.date &&
        t.type === candidate.type &&
        Number(t.amount) === Number(candidate.amount) &&
        String(t.description || '').trim() === String(candidate.description || '').trim() &&
        t.bank === candidate.bank &&
        t.accountType === candidate.accountType
    );
}

// Get statistics
async function getStats(accountType, year, bank = 'all', month = null) {
    const transactions = await getTransactions({ accountType, bank });
    
    let filtered = transactions;
    if (year) {
        filtered = filtered.filter(t => t.date.startsWith(year));
    }
    if (month) {
        filtered = filtered.filter(t => {
            const monthNum = parseInt(t.date.split('-')[1]);
            return monthNum === month;
        });
    }
    
    const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expense;
    
    // Category breakdown
    const categoryBreakdown = {};
    filtered.forEach(t => {
        if (!categoryBreakdown[t.category]) {
            categoryBreakdown[t.category] = { income: 0, expense: 0 };
        }
        categoryBreakdown[t.category][t.type] += t.amount;
    });
    
    return { income, expense, balance, categoryBreakdown, total: filtered.length };
}

// Get monthly statistics for a year
async function getMonthlyStats(accountType, year, bank = 'all') {
    const monthly = [];
    for (let month = 1; month <= 12; month++) {
        const stats = await getStats(accountType, year, bank, month);
        monthly.push({
            month,
            ...stats
        });
    }
    return monthly;
}

// Clear all data
async function clearAllData() {
    const db = await openDB();
    
    const tx1 = db.transaction([STORE_NAME], 'readwrite');
    tx1.objectStore(STORE_NAME).clear();
    
    const tx2 = db.transaction([CATEGORIES_STORE], 'readwrite');
    tx2.objectStore(CATEGORIES_STORE).clear();

    const tx3 = db.transaction([BANKS_STORE], 'readwrite');
    tx3.objectStore(BANKS_STORE).clear();
    
    return new Promise((resolve, reject) => {
        Promise.all([
            new Promise((res) => { tx1.oncomplete = res; }),
            new Promise((res) => { tx2.oncomplete = res; }),
            new Promise((res) => { tx3.oncomplete = res; })
        ]).then(() => {
            initCategories().then(resolve);
        }).catch(reject);
    });
}

// Export all data
async function exportAllData() {
    const transactions = await getTransactions({});
    const categories = await getCategories();
    const banks = await getBanks();
    return {
        version: 2,
        exportedAt: new Date().toISOString(),
        transactions,
        categories,
        banks
    };
}

// Import data (restore from backup)
async function importData(data) {
    if (!data.transactions || !data.categories) {
        throw new Error('Invalid backup file');
    }

    const db = await openDB();

    await new Promise((resolve, reject) => {
        const stores = [STORE_NAME, CATEGORIES_STORE, BANKS_STORE];
        const tx = db.transaction(stores, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.objectStore(CATEGORIES_STORE).clear();
        tx.objectStore(BANKS_STORE).clear();
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });

    await new Promise((resolve, reject) => {
        const stores = [STORE_NAME, CATEGORIES_STORE, BANKS_STORE];
        const tx = db.transaction(stores, 'readwrite');
        const txStore = tx.objectStore(STORE_NAME);
        const catStore = tx.objectStore(CATEGORIES_STORE);
        const bankStore = tx.objectStore(BANKS_STORE);

        data.transactions.forEach(t => txStore.put(t));
        data.categories.forEach(c => catStore.put(c));
        if (data.banks) data.banks.forEach(b => bankStore.put(b));

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}