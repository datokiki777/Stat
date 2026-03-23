// Database configuration
const DB_NAME = 'StatApp';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';
const CATEGORIES_STORE = 'categories';

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
                store.createIndex('date_accountType', ['date', 'accountType'], { unique: false });
            }
            
            // Categories store
            if (!database.objectStoreNames.contains(CATEGORIES_STORE)) {
                const catStore = database.createObjectStore(CATEGORIES_STORE, { keyPath: 'id' });
                catStore.createIndex('type', 'type', { unique: false });
                catStore.createIndex('name', 'name', { unique: false });
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
            resolve(categories.sort((a, b) => a.name.localeCompare(b.name)));
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
        name,
        type
    };
    
    return new Promise((resolve, reject) => {
        const request = store.add(newCategory);
        request.onsuccess = () => resolve(newCategory);
        request.onerror = () => reject(request.error);
    });
}

// Delete category
async function deleteCategory(id) {
    const db = await openDB();
    const transaction = db.transaction([CATEGORIES_STORE], 'readwrite');
    const store = transaction.objectStore(CATEGORIES_STORE);
    
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
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

            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            resolve(transactions);
        };

        request.onerror = () => reject(request.error);
    });
}

// Get statistics
async function getStats(accountType, year, month = null) {
    const transactions = await getTransactions({ accountType });
    
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
async function getMonthlyStats(accountType, year) {
    const monthly = [];
    for (let month = 1; month <= 12; month++) {
        const stats = await getStats(accountType, year, month);
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
    
    // Clear transactions
    const tx1 = db.transaction([STORE_NAME], 'readwrite');
    tx1.objectStore(STORE_NAME).clear();
    
    // Clear categories and re-add defaults
    const tx2 = db.transaction([CATEGORIES_STORE], 'readwrite');
    tx2.objectStore(CATEGORIES_STORE).clear();
    
    return new Promise((resolve, reject) => {
        Promise.all([
            new Promise((res) => { tx1.oncomplete = res; }),
            new Promise((res) => { tx2.oncomplete = res; })
        ]).then(() => {
            initCategories().then(resolve);
        }).catch(reject);
    });
}

// Export all data
async function exportAllData() {
    const transactions = await getTransactions({});
    const categories = await getCategories();
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        transactions,
        categories
    };
}

// Import data (restore from backup)
async function importData(data) {
    if (!data.transactions || !data.categories) {
        throw new Error('Invalid backup file');
    }

    const db = await openDB();

    await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME, CATEGORIES_STORE], 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.objectStore(CATEGORIES_STORE).clear();

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });

    await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME, CATEGORIES_STORE], 'readwrite');
        const txStore = tx.objectStore(STORE_NAME);
        const catStore = tx.objectStore(CATEGORIES_STORE);

        data.transactions.forEach(t => txStore.put(t));
        data.categories.forEach(c => catStore.put(c));

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}