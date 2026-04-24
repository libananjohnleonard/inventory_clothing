import { useEffect, useState } from 'react'
import { inventoryApi } from './lib/api'

const navigationItems = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Inventory', icon: 'inventory' },
  { label: 'Reports', icon: 'reports' },
  { label: 'Profile', icon: 'profile' },
]
const BRAND_NAME = 'Edmund Clothing Inventory'
const columns = ['Item', 'Category', 'SKU', 'Quantity', 'Description', 'Updates', 'Actions']
const PAGE_SIZE = 10
const SESSION_STORAGE_KEY = 'edmund-clothing-inventory-session'
const SESSION_EMAIL_STORAGE_KEY = 'edmund-clothing-admin-email'

const emptyProductForm = {
  name: '',
  category: '',
  sku: '',
  description: '',
  items: '',
  imageUrl: '',
  imageName: '',
}

const emptySignInForm = {
  email: '',
  password: '',
}

function getStoredSession() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(SESSION_STORAGE_KEY) === 'active'
}

function getStoredSessionEmail() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(SESSION_EMAIL_STORAGE_KEY) || ''
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Unable to read image file.'))

    reader.readAsDataURL(file)
  })
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'EC'
}

function formatItemCount(value) {
  const amount = Number(value || 0)
  return `${amount} ${amount === 1 ? 'item' : 'items'}`
}

function buildUpdateMessage({ previousProduct, nextValues, mode }) {
  if (mode === 'add') {
    return 'Recently added item'
  }

  if (!previousProduct) {
    return 'Item updated'
  }

  const updates = []
  const nextItems = Number(nextValues.items || 0)
  const previousItems = Number(previousProduct.items || 0)
  const itemDelta = nextItems - previousItems

  if (itemDelta !== 0) {
    updates.push(
      `${itemDelta > 0 ? '+' : ''}${itemDelta} ${
        Math.abs(itemDelta) === 1 ? 'item' : 'items'
      } updated`,
    )
  }

  if (previousProduct.description.trim() !== nextValues.description.trim()) {
    updates.push('Description updated')
  }

  const previousImage = previousProduct.imageUrl.trim()
  const nextImage = nextValues.imageUrl.trim()

  if (previousImage && !nextImage) {
    updates.push('Image deleted')
  } else if (!previousImage && nextImage) {
    updates.push('Image added')
  } else if (previousImage !== nextImage) {
    updates.push('Image updated')
  }

  const detailsChanged =
    previousProduct.name.trim() !== nextValues.name.trim() ||
    previousProduct.category.trim() !== nextValues.category.trim() ||
    previousProduct.sku.trim() !== nextValues.sku.trim()

  if (!updates.length && detailsChanged) {
    updates.push('Item details updated')
  }

  if (!updates.length) {
    updates.push(previousProduct.updates || 'No recent changes')
  }

  return updates.slice(0, 2).join(' / ')
}

function filterProducts(products, searchQuery) {
  const keyword = searchQuery.trim().toLowerCase()

  if (!keyword) {
    return products
  }

  return products.filter((product) =>
    [
      product.name,
      product.category,
      product.sku,
      product.description,
      product.updates,
      String(product.items),
      formatItemCount(product.items),
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword),
  )
}

function getStockStatus(items) {
  const quantity = Number(items || 0)
  if (quantity <= 0) return 'Out of Stock'
  if (quantity <= 20) return 'Low Stock'
  return 'Healthy'
}

function getTotalPages(totalItems) {
  return Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
}

function paginateProducts(products, page) {
  const startIndex = (page - 1) * PAGE_SIZE
  return products.slice(startIndex, startIndex + PAGE_SIZE)
}

function Icon({ name }) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.9',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  if (name === 'logo') {
    return (
      <svg {...commonProps}>
        <path d="M7 7.5h10" />
        <path d="M8.5 3.5h7l1.5 4H7l1.5-4Z" />
        <path d="M7 7.5 5.8 20h12.4L17 7.5" />
        <path d="M9.5 11.5c.6 1.2 1.4 1.8 2.5 1.8s1.9-.6 2.5-1.8" />
      </svg>
    )
  }

  if (name === 'dashboard') {
    return (
      <svg {...commonProps}>
        <rect x="3.5" y="4" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="4" width="7" height="5" rx="1.5" />
        <rect x="13.5" y="12" width="7" height="8" rx="1.5" />
        <rect x="3.5" y="14" width="7" height="6" rx="1.5" />
      </svg>
    )
  }

  if (name === 'inventory') {
    return (
      <svg {...commonProps}>
        <path d="M4.5 7.5 12 3.5l7.5 4-7.5 4-7.5-4Z" />
        <path d="M4.5 7.5v8.8l7.5 4.2 7.5-4.2V7.5" />
        <path d="M12 11.5v9" />
      </svg>
    )
  }

  if (name === 'reports') {
    return (
      <svg {...commonProps}>
        <path d="M6 20V4h12v16" />
        <path d="M9 16v-5" />
        <path d="M12 16V8" />
        <path d="M15 16v-3" />
        <path d="M4 20h16" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c1.2-3.2 3.4-4.8 6.5-4.8s5.3 1.6 6.5 4.8" />
    </svg>
  )
}

function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [products, setProducts] = useState([])
  const [editor, setEditor] = useState({ open: false, mode: 'add', productId: null })
  const [formValues, setFormValues] = useState(emptyProductForm)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pageByView, setPageByView] = useState({ Dashboard: 1, Inventory: 1 })
  const [account, setAccount] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(getStoredSession)
  const [isAuthLoading, setIsAuthLoading] = useState(getStoredSession)
  const [isProductsLoading, setIsProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [signInForm, setSignInForm] = useState(emptySignInForm)
  const [signInError, setSignInError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (isAuthenticated) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, 'active')

      if (account?.email) {
        window.localStorage.setItem(SESSION_EMAIL_STORAGE_KEY, account.email)
      }

      return
    }

    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    window.localStorage.removeItem(SESSION_EMAIL_STORAGE_KEY)
  }, [account?.email, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setIsAuthLoading(false)
      setAccount(null)
      setProducts([])
      return
    }

    let isCancelled = false

    async function bootstrap() {
      setIsAuthLoading(true)
      setIsProductsLoading(true)

      try {
        const storedAdminEmail = getStoredSessionEmail()
        const [profileResponse, productsResponse] = await Promise.all([
          inventoryApi.getProfile(storedAdminEmail),
          inventoryApi.getProducts(),
        ])

        if (isCancelled) return

        setAccount(profileResponse.user)
        setProducts(productsResponse.products || [])
        setProductsError('')
      } catch {
        if (!isCancelled) {
          setIsAuthenticated(false)
          setSignInError('Unable to restore your session. Please sign in again.')
          setProductsError('')
        }
      } finally {
        if (!isCancelled) {
          setIsAuthLoading(false)
          setIsProductsLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      isCancelled = true
    }
  }, [isAuthenticated])

  const filteredProducts = filterProducts(products, searchQuery)
  const dashboardTotalPages = getTotalPages(products.length)
  const inventoryTotalPages = getTotalPages(filteredProducts.length)
  const dashboardPage = Math.min(pageByView.Dashboard, dashboardTotalPages)
  const inventoryPage = Math.min(pageByView.Inventory, inventoryTotalPages)
  const dashboardProducts = paginateProducts(products, dashboardPage)
  const inventoryProducts = paginateProducts(filteredProducts, inventoryPage)

  const closeEditor = () => {
    setEditor({ open: false, mode: 'add', productId: null })
    setFormValues(emptyProductForm)
    setIsImageLoading(false)
    setIsSavingProduct(false)
  }

  const openAddModal = () => {
    setEditor({ open: true, mode: 'add', productId: null })
    setFormValues(emptyProductForm)
    setIsImageLoading(false)
  }

  const openEditModal = (product) => {
    setEditor({ open: true, mode: 'edit', productId: product.id })
    setFormValues({
      name: product.name,
      category: product.category,
      sku: product.sku,
      description: product.description,
      items: String(product.items),
      imageUrl: product.imageUrl,
      imageName: product.imageUrl ? `${product.name} image` : '',
    })
    setIsImageLoading(false)
  }

  const closeOverlays = () => {
    setDeleteTarget(null)
    setViewTarget(null)
    closeEditor()
  }

  const handleNavigate = (page) => {
    setActivePage(page)
    closeOverlays()
  }

  const handleProductFieldChange = (field, value) => {
    setFormValues((current) => ({ ...current, [field]: value }))
  }

  const handleImageSelect = async (file) => {
    if (!file) return

    setIsImageLoading(true)

    try {
      const imageUrl = await readFileAsDataUrl(file)

      setFormValues((current) => ({
        ...current,
        imageUrl,
        imageName: file.name,
      }))
    } finally {
      setIsImageLoading(false)
    }
  }

  const handleImageRemove = () => {
    setFormValues((current) => ({
      ...current,
      imageUrl: '',
      imageName: '',
    }))
  }

  const handleSearchChange = (value) => {
    setSearchQuery(value)
    setPageByView({ Dashboard: 1, Inventory: 1 })
  }

  const handlePageChange = (pageName, nextPage) => {
    setPageByView((current) => ({
      ...current,
      [pageName]: Math.max(1, nextPage),
    }))
  }

  const handleProductSubmit = async (event) => {
    event.preventDefault()

    if (isImageLoading || isSavingProduct) {
      return
    }

    const previousProduct =
      editor.mode === 'edit'
        ? products.find((product) => product.id === editor.productId) ?? null
        : null

    const payload = {
      name: formValues.name.trim(),
      category: formValues.category.trim(),
      sku: formValues.sku.trim(),
      description: formValues.description.trim(),
      items: Number(formValues.items),
      imageUrl: formValues.imageUrl.trim(),
      updates: buildUpdateMessage({ previousProduct, nextValues: formValues, mode: editor.mode }),
    }

    setIsSavingProduct(true)

    try {
      if (editor.mode === 'edit') {
        const response = await inventoryApi.updateProduct(editor.productId, payload)
        setProducts((current) =>
          current.map((product) => (product.id === editor.productId ? response.product : product)),
        )
      } else {
        const response = await inventoryApi.createProduct(payload)
        setProducts((current) => [response.product, ...current])
      }

      setProductsError('')
      closeEditor()
    } catch (error) {
      setProductsError(error.message)
      setIsSavingProduct(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      await inventoryApi.deleteProduct(deleteTarget.id)
      setProducts((current) => current.filter((product) => product.id !== deleteTarget.id))
      setProductsError('')
      setDeleteTarget(null)
    } catch (error) {
      setProductsError(error.message)
    }
  }

  const handleSignInFieldChange = (field, value) => {
    setSignInForm((current) => ({ ...current, [field]: value }))
    setSignInError('')
  }

  const handleSignIn = async (event) => {
    event.preventDefault()

    try {
      const response = await inventoryApi.login(signInForm)
      setAccount(response.user)
      setSignInForm(emptySignInForm)
      setSignInError('')
      setIsAuthenticated(true)
      setActivePage('Dashboard')
    } catch (error) {
      setSignInError(error.message)
    }
  }

  const handleSignOut = () => {
    setIsAuthenticated(false)
    setAccount(null)
    setProducts([])
    setProductsError('')
    setSearchQuery('')
    setPageByView({ Dashboard: 1, Inventory: 1 })
    setActivePage('Dashboard')
    closeOverlays()
  }

  const handleProfileSave = async ({ name, role, workspace }) => {
    const response = await inventoryApi.updateProfile({
      adminEmail: account?.email || getStoredSessionEmail(),
      name,
      role,
      workspace,
    })

    setAccount(response.user)
    return { ok: true, message: 'Profile details updated.' }
  }

  const handleEmailSave = async ({ email, currentPassword }) => {
    const response = await inventoryApi.updateEmail({
      adminEmail: account?.email || getStoredSessionEmail(),
      email,
      currentPassword,
    })

    setAccount(response.user)
    return { ok: true, message: 'Email updated successfully.' }
  }

  const handlePasswordSave = async ({ currentPassword, nextPassword }) => {
    await inventoryApi.updatePassword({
      adminEmail: account?.email || getStoredSessionEmail(),
      currentPassword,
      nextPassword,
    })

    return { ok: true, message: 'Password updated successfully.' }
  }

  const renderPage = () => {
    if (activePage === 'Inventory') {
      return (
        <CatalogPanel
          eyebrow="Inventory"
          title="Manage Clothing Items"
          description="Create, update, and remove clothing inventory records stored in your PostgreSQL database."
          products={inventoryProducts}
          totalCount={products.length}
          searchQuery={searchQuery}
          filteredCount={filteredProducts.length}
          currentPage={inventoryPage}
          totalPages={inventoryTotalPages}
          isLoading={isProductsLoading}
          errorMessage={productsError}
          onSearchChange={handleSearchChange}
          onPreviousPage={() => handlePageChange('Inventory', inventoryPage - 1)}
          onNextPage={() => handlePageChange('Inventory', inventoryPage + 1)}
          manageMode
          actions={
            <button type="button" className="primary-button" onClick={openAddModal}>
              Add Item
            </button>
          }
          onEdit={openEditModal}
          onDelete={setDeleteTarget}
        />
      )
    }

    if (activePage === 'Reports') {
      return <ReportsPanel products={products} />
    }

    if (activePage === 'Profile' && account) {
      return (
        <ProfilePanel
          products={products}
          account={account}
          onProfileSave={handleProfileSave}
          onEmailSave={handleEmailSave}
          onPasswordSave={handlePasswordSave}
          onSignOut={handleSignOut}
        />
      )
    }

    return (
      <CatalogPanel
        eyebrow="Dashboard"
        title="Clothing Board"
        description="A card view of the latest clothing item records stored in your inventory database."
        products={dashboardProducts}
        totalCount={products.length}
        searchQuery=""
        filteredCount={products.length}
        currentPage={dashboardPage}
        totalPages={dashboardTotalPages}
        isLoading={isProductsLoading}
        errorMessage={productsError}
        onSearchChange={() => {}}
        onPreviousPage={() => handlePageChange('Dashboard', dashboardPage - 1)}
        onNextPage={() => handlePageChange('Dashboard', dashboardPage + 1)}
        cardMode
        showSearch={false}
        onView={setViewTarget}
      />
    )
  }

  if (isAuthLoading) {
    return <LoadingScreen message="Loading your clothing inventory..." />
  }

  if (!isAuthenticated) {
    return (
      <SignInScreen
        formValues={signInForm}
        error={signInError}
        onChange={handleSignInFieldChange}
        onSubmit={handleSignIn}
      />
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button
            type="button"
            className="header-logo"
            aria-label="Go to dashboard"
            onClick={() => handleNavigate('Dashboard')}
          >
            <Icon name="logo" />
          </button>

          <div className="topbar-actions">
            <nav className="nav-tabs" aria-label="Primary navigation">
              {navigationItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={item.label === activePage ? 'nav-button is-active' : 'nav-button'}
                  onClick={() => handleNavigate(item.label)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <section className="page-wrap">{renderPage()}</section>

      {editor.open ? (
        <ProductModal
          mode={editor.mode}
          formValues={formValues}
          onChange={handleProductFieldChange}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          onClose={closeEditor}
          onSubmit={handleProductSubmit}
          isImageLoading={isImageLoading}
          isSaving={isSavingProduct}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          product={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      {viewTarget ? <ProductDetailsModal product={viewTarget} onClose={() => setViewTarget(null)} /> : null}
    </main>
  )
}

function LoadingScreen({ message }) {
  return (
    <main className="auth-shell auth-shell-loading">
      <section className="auth-card auth-card-loading">
        <div className="auth-copy">
          <p className="panel-kicker">Loading</p>
          <h1 className="auth-title">Connecting to {BRAND_NAME}</h1>
          <p className="auth-description">{message}</p>
        </div>
      </section>
    </main>
  )
}

function PasswordInput({ value, onChange, placeholder, showPassword, onToggle, required = true }) {
  return (
    <div className="password-input-wrap">
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
      <button type="button" className="password-visibility-toggle" onClick={onToggle}>
        {showPassword ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

function SignInScreen({ formValues, error, onChange, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-side-panel">
          <p className="panel-kicker">Secure Access</p>
          <h1 className="auth-title">Sign In</h1>
          <p className="auth-description">
            Enter your admin credentials to open the clothing inventory workspace.
          </p>
          <div className="auth-side-list" aria-label="Workspace areas">
            <span>Dashboard</span>
            <span>Inventory</span>
            <span>Reports</span>
            <span>Profile</span>
          </div>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="auth-form-header">
            <span>{BRAND_NAME}</span>
            <strong>Welcome back</strong>
          </div>

          <label className="form-field">
            Email
            <input
              type="email"
              value={formValues.email}
              onChange={(event) => onChange('email', event.target.value)}
              placeholder="Enter your email"
              required
            />
          </label>

          <label className="form-field">
            Password
            <PasswordInput
              value={formValues.password}
              onChange={(event) => onChange('password', event.target.value)}
              placeholder="Enter your password"
              showPassword={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
            />
          </label>

          {error ? <p className="form-feedback form-feedback-error">{error}</p> : null}

          <button type="submit" className="primary-button auth-submit">
            Sign In
          </button>
        </form>
      </section>
    </main>
  )
}

function CatalogPanel({
  eyebrow,
  title,
  description,
  products,
  totalCount,
  searchQuery,
  filteredCount,
  currentPage,
  totalPages,
  isLoading,
  errorMessage,
  onSearchChange,
  onPreviousPage,
  onNextPage,
  summaryCards = null,
  actions = null,
  manageMode = false,
  cardMode = false,
  showSearch = true,
  onEdit = null,
  onDelete = null,
  onView = null,
}) {
  return (
    <section className="inventory-panel" aria-label={title}>
      <div className="panel-toolbar">
        <div className="panel-copy">
          <p className="panel-kicker">{eyebrow}</p>
          <h1 className="panel-title">{title}</h1>
          <p className="panel-description">{description}</p>
        </div>
        {showSearch || actions ? (
          <div className="panel-utility">
            {showSearch ? (
              <label className="search-field">
                <span className="search-label">Search</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search item, SKU, category, quantity..."
                />
              </label>
            ) : null}
          {actions ? <div className="panel-actions">{actions}</div> : null}
          </div>
        ) : null}
      </div>

      {errorMessage ? <p className="panel-status panel-status-error">{errorMessage}</p> : null}

      {summaryCards?.length ? (
        <section className="dashboard-summary-grid" aria-label="Dashboard item summary">
          {summaryCards.map((card) => (
            <article key={card.label} className="dashboard-summary-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </section>
      ) : null}

      {cardMode ? (
        <div className="dashboard-card-grid">
          {isLoading ? (
            <div className="empty-state dashboard-empty-state">
              <strong>Loading clothing items from the database...</strong>
              <p>Your latest clothing inventory records are being fetched.</p>
            </div>
          ) : products.length ? (
            products.map((product) => (
              <article key={product.id} className="dashboard-item-card">
                <div className="dashboard-product-media">
                  <ProductImage name={product.name} imageUrl={product.imageUrl} />
                  {getStockStatus(product.items) === 'Low Stock' ? (
                    <span className="stock-chip stock-chip--low-stock">Low Stock</span>
                  ) : null}
                </div>
                <div className="dashboard-item-copy">
                  <span>{product.category}</span>
                  <h2>{product.name}</h2>
                  <p>{product.description}</p>
                </div>
                <div className="dashboard-item-meta">
                  <div>
                    <span>SKU</span>
                    <strong>{product.sku}</strong>
                  </div>
                  <div>
                    <span>Stock</span>
                    <strong>{formatItemCount(product.items)}</strong>
                  </div>
                </div>
                <button type="button" className="inline-button" onClick={() => onView(product)}>
                  View
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state dashboard-empty-state">
              <strong>No clothing items in the database yet.</strong>
              <p>Use the Inventory page to add your first clothing item.</p>
            </div>
          )}

          {filteredCount && !isLoading ? (
            <div className="table-footer dashboard-card-footer">
              <span className="pagination-status">
                Page {currentPage} of {totalPages}
              </span>
              <div className="pagination-actions">
                <button
                  type="button"
                  className="pagination-button"
                  onClick={onPreviousPage}
                  disabled={currentPage === 1}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="pagination-button"
                  onClick={onNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="inventory-grid">
          <div className="inventory-header" role="row">
            {columns.map((column) => (
              <div key={column} className="inventory-heading" role="columnheader">
                {column}
              </div>
            ))}
          </div>

          {isLoading ? (
          <div className="empty-state">
            <strong>Loading clothing items from the database...</strong>
            <p>Your latest clothing inventory records are being fetched.</p>
          </div>
        ) : products.length ? (
          <div className="inventory-body">
            {products.map((product) => (
              <article key={product.id} className="inventory-row" role="row">
                <div className="inventory-cell product-cell" role="cell">
                  <ProductImage name={product.name} imageUrl={product.imageUrl} />
                  <div className="product-meta">
                    <strong>{product.name}</strong>
                    <span>{manageMode ? 'Saved in clothing inventory database' : 'Database snapshot'}</span>
                  </div>
                </div>
                <div className="inventory-cell" role="cell">
                  {product.category}
                </div>
                <div className="inventory-cell" role="cell">
                  {product.sku}
                </div>
                <div className="inventory-cell quantity-cell" role="cell">
                  {formatItemCount(product.items)}
                </div>
                <div className="inventory-cell description-cell" role="cell">
                  {product.description}
                </div>
                <div className="inventory-cell updates-cell" role="cell">
                  {product.updates}
                </div>
                <div className="inventory-cell" role="cell">
                  {manageMode ? (
                    <div className="action-group">
                      <button type="button" className="inline-button" onClick={() => onEdit(product)}>
                        Update
                      </button>
                      <button
                        type="button"
                        className="inline-button inline-button-danger"
                        onClick={() => onDelete(product)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="inline-button" onClick={() => onView(product)}>
                      View
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>{totalCount ? 'No matching items found.' : 'No clothing items in the database yet.'}</strong>
            <p>
              {totalCount
                ? `Try a different search term or clear "${searchQuery}".`
                : 'Use the Inventory page to add your first clothing item.'}
            </p>
          </div>
        )}

          {filteredCount && !isLoading ? (
            <div className="table-footer">
              <span className="pagination-status">
                Page {currentPage} of {totalPages}
              </span>
              <div className="pagination-actions">
                <button
                  type="button"
                  className="pagination-button"
                  onClick={onPreviousPage}
                  disabled={currentPage === 1}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="pagination-button"
                  onClick={onNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

function ReportsPanel({ products }) {
  const totalItems = products.length
  const totalStock = products.reduce((sum, product) => sum + Number(product.items || 0), 0)
  const averageStock = totalItems ? Math.round(totalStock / totalItems) : 0
  const lowStockProducts = products.filter((product) => getStockStatus(product.items) === 'Low Stock')
  const outOfStockProducts = products.filter((product) => getStockStatus(product.items) === 'Out of Stock')
  const recentlyAddedItems = products.filter((product) =>
    product.updates.toLowerCase().includes('recently added'),
  )
  const highestStockProducts = [...products].sort((left, right) => right.items - left.items).slice(0, 4)
  const latestActivity = [...products].slice(0, 5)

  return (
    <section className="inventory-panel" aria-label="Reports">
      <div className="panel-toolbar">
        <div className="panel-copy">
          <p className="panel-kicker">Reports</p>
          <h1 className="panel-title">Inventory Reports</h1>
          <p className="panel-description">
            Review stock health, recent changes, and item movement from the current clothing inventory records.
          </p>
        </div>
      </div>

      <section className="report-summary-grid" aria-label="Report summary">
        <article className="dashboard-summary-card">
          <span>Total Items</span>
          <strong>{totalItems}</strong>
        </article>
        <article className="dashboard-summary-card">
          <span>Total Stock</span>
          <strong>{formatItemCount(totalStock)}</strong>
        </article>
        <article className="dashboard-summary-card">
          <span>Average Quantity</span>
          <strong>{formatItemCount(averageStock)}</strong>
        </article>
        <article className="dashboard-summary-card">
          <span>Recently Added</span>
          <strong>{recentlyAddedItems.length} items</strong>
        </article>
      </section>

      <section className="report-content-grid">
        <article className="report-card report-card--wide">
          <div className="report-card-header">
            <p className="panel-kicker">Stock Ranking</p>
            <h2 className="report-title">Highest Quantity Items</h2>
          </div>
          <div className="report-list">
            {highestStockProducts.length ? (
              highestStockProducts.map((product) => (
                <div key={product.id} className="report-item">
                  <div>
                    <strong>{product.name}</strong>
                    <span>
                      {product.sku} / {product.category}
                    </span>
                  </div>
                  <strong>{formatItemCount(product.items)}</strong>
                </div>
              ))
            ) : (
              <p className="report-empty">No clothing items available yet.</p>
            )}
          </div>
        </article>

        <article className="report-card">
          <div className="report-card-header">
            <p className="panel-kicker">Attention</p>
            <h2 className="report-title">Low And Out Of Stock</h2>
          </div>
          <div className="report-list">
            {[...lowStockProducts, ...outOfStockProducts].length ? (
              [...lowStockProducts, ...outOfStockProducts].map((product) => (
                <div key={product.id} className="report-item">
                  <div>
                    <strong>{product.name}</strong>
                    <span>{getStockStatus(product.items)}</span>
                  </div>
                  <strong>{formatItemCount(product.items)}</strong>
                </div>
              ))
            ) : (
              <p className="report-empty">No critical stock alerts right now.</p>
            )}
          </div>
        </article>

        <article className="report-card">
          <div className="report-card-header">
            <p className="panel-kicker">Activity</p>
            <h2 className="report-title">Recent Item Updates</h2>
          </div>
          <div className="report-list">
            {latestActivity.length ? (
              latestActivity.map((product) => (
                <div key={product.id} className="report-item">
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.updates}</span>
                  </div>
                  <strong>{formatItemCount(product.items)}</strong>
                </div>
              ))
            ) : (
              <p className="report-empty">No item activity yet.</p>
            )}
          </div>
        </article>
      </section>
    </section>
  )
}

function ProfilePanel({ products, account, onProfileSave, onEmailSave, onPasswordSave, onSignOut }) {
  const totalStock = products.reduce((sum, product) => sum + Number(product.items || 0), 0)
  const lowStockCount = products.filter((product) => getStockStatus(product.items) === 'Low Stock').length
  const outOfStockCount = products.filter((product) => getStockStatus(product.items) === 'Out of Stock').length
  const [profileForm, setProfileForm] = useState({
    name: account.name,
    role: account.role,
    workspace: account.workspace,
  })
  const [emailForm, setEmailForm] = useState({
    email: account.email,
    currentPassword: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  })
  const [profileFeedback, setProfileFeedback] = useState(null)
  const [emailFeedback, setEmailFeedback] = useState(null)
  const [passwordFeedback, setPasswordFeedback] = useState(null)
  const [passwordVisibility, setPasswordVisibility] = useState({
    emailCurrent: false,
    passwordCurrent: false,
    passwordNext: false,
    passwordConfirm: false,
  })

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((current) => ({
      ...current,
      [field]: !current[field],
    }))
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()

    if (!profileForm.name.trim() || !profileForm.role.trim() || !profileForm.workspace.trim()) {
      setProfileFeedback({ tone: 'error', message: 'Complete all profile fields before saving.' })
      return
    }

    try {
      const result = await onProfileSave(profileForm)
      setProfileFeedback({ tone: result.ok ? 'success' : 'error', message: result.message })
    } catch (error) {
      setProfileFeedback({ tone: 'error', message: error.message })
    }
  }

  const handleEmailSubmit = async (event) => {
    event.preventDefault()

    if (!emailForm.email.trim() || !emailForm.currentPassword) {
      setEmailFeedback({ tone: 'error', message: 'Enter the new email and your current password.' })
      return
    }

    try {
      const result = await onEmailSave(emailForm)
      setEmailFeedback({ tone: result.ok ? 'success' : 'error', message: result.message })

      if (result.ok) {
        setEmailForm((current) => ({ ...current, currentPassword: '' }))
      }
    } catch (error) {
      setEmailFeedback({ tone: 'error', message: error.message })
    }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()

    if (!passwordForm.currentPassword || !passwordForm.nextPassword || !passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: 'error', message: 'Complete all password fields before saving.' })
      return
    }

    if (passwordForm.nextPassword.length < 4) {
      setPasswordFeedback({ tone: 'error', message: 'Use at least 4 characters for the new password.' })
      return
    }

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: 'error', message: 'New password and confirmation do not match.' })
      return
    }

    try {
      const result = await onPasswordSave(passwordForm)
      setPasswordFeedback({ tone: result.ok ? 'success' : 'error', message: result.message })

      if (result.ok) {
        setPasswordForm({
          currentPassword: '',
          nextPassword: '',
          confirmPassword: '',
        })
      }
    } catch (error) {
      setPasswordFeedback({ tone: 'error', message: error.message })
    }
  }

  return (
    <section className="inventory-panel" aria-label="Profile">
      <div className="panel-toolbar">
        <div className="panel-copy">
          <p className="panel-kicker">Profile</p>
          <h1 className="panel-title">Account Profile</h1>
          <p className="panel-description">
            Manage your profile details, email, and password for the clothing inventory admin account stored in PostgreSQL.
          </p>
        </div>
      </div>

      <section className="profile-grid">
        <article className="profile-card profile-card--hero">
          <div className="profile-hero-topline">
            <div className="profile-avatar">{getInitials(account.name)}</div>
            <button type="button" className="secondary-button profile-logout-button" onClick={onSignOut}>
              Log Out
            </button>
          </div>
          <div className="profile-identity">
            <h2>{account.name}</h2>
            <p>{account.role}</p>
          </div>
          <div className="profile-details-grid">
            <div className="profile-detail">
              <span>Email</span>
              <strong>{account.email}</strong>
            </div>
            <div className="profile-detail">
              <span>Workspace</span>
              <strong>{account.workspace}</strong>
            </div>
            <div className="profile-detail">
              <span>Role</span>
              <strong>{account.role}</strong>
            </div>
            <div className="profile-detail">
              <span>Member Since</span>
              <strong>{account.memberSince}</strong>
            </div>
          </div>
        </article>

        <article className="profile-card">
          <div className="report-card-header">
            <p className="panel-kicker">Workspace Snapshot</p>
            <h2 className="report-title">Current Clothing Inventory</h2>
          </div>
          <div className="profile-stats-list">
            <div className="profile-stat-row">
              <span>Items Managed</span>
              <strong>{products.length}</strong>
            </div>
            <div className="profile-stat-row">
              <span>Total Stock</span>
              <strong>{formatItemCount(totalStock)}</strong>
            </div>
            <div className="profile-stat-row">
              <span>Low Stock Alerts</span>
              <strong>{lowStockCount}</strong>
            </div>
            <div className="profile-stat-row">
              <span>Out Of Stock</span>
              <strong>{outOfStockCount}</strong>
            </div>
          </div>
        </article>

        <article className="profile-card profile-card--full">
          <div className="report-card-header">
            <p className="panel-kicker">Manage Profile</p>
            <h2 className="report-title">Profile Details</h2>
          </div>

          <form className="profile-form" onSubmit={handleProfileSubmit}>
            <div className="form-grid">
              <label className="form-field">
                Full Name
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(event) => {
                    setProfileForm((current) => ({ ...current, name: event.target.value }))
                    setProfileFeedback(null)
                  }}
                  required
                />
              </label>

              <label className="form-field">
                Role
                <input
                  type="text"
                  value={profileForm.role}
                  onChange={(event) => {
                    setProfileForm((current) => ({ ...current, role: event.target.value }))
                    setProfileFeedback(null)
                  }}
                  required
                />
              </label>

              <label className="form-field form-field--full">
                Workspace
                <input
                  type="text"
                  value={profileForm.workspace}
                  onChange={(event) => {
                    setProfileForm((current) => ({ ...current, workspace: event.target.value }))
                    setProfileFeedback(null)
                  }}
                  required
                />
              </label>
            </div>

            {profileFeedback ? (
              <p
                className={
                  profileFeedback.tone === 'success'
                    ? 'form-feedback form-feedback-success'
                    : 'form-feedback form-feedback-error'
                }
              >
                {profileFeedback.message}
              </p>
            ) : null}

            <div className="profile-form-actions">
              <button type="submit" className="primary-button">
                Save Profile
              </button>
            </div>
          </form>
        </article>

        <article className="profile-card">
          <div className="report-card-header">
            <p className="panel-kicker">Manage Email</p>
            <h2 className="report-title">Email Settings</h2>
          </div>

          <form className="profile-form" onSubmit={handleEmailSubmit}>
            <div className="form-grid">
              <label className="form-field form-field--full">
                Email Address
                <input
                  type="email"
                  value={emailForm.email}
                  onChange={(event) => {
                    setEmailForm((current) => ({ ...current, email: event.target.value }))
                    setEmailFeedback(null)
                  }}
                  required
                />
              </label>

              <label className="form-field form-field--full">
                Current Password
                <PasswordInput
                  value={emailForm.currentPassword}
                  onChange={(event) => {
                    setEmailForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                    setEmailFeedback(null)
                  }}
                  placeholder="Enter your current password"
                  showPassword={passwordVisibility.emailCurrent}
                  onToggle={() => togglePasswordVisibility('emailCurrent')}
                />
              </label>
            </div>

            {emailFeedback ? (
              <p
                className={
                  emailFeedback.tone === 'success'
                    ? 'form-feedback form-feedback-success'
                    : 'form-feedback form-feedback-error'
                }
              >
                {emailFeedback.message}
              </p>
            ) : null}

            <div className="profile-form-actions">
              <button type="submit" className="primary-button">
                Update Email
              </button>
            </div>
          </form>
        </article>

        <article className="profile-card">
          <div className="report-card-header">
            <p className="panel-kicker">Manage Password</p>
            <h2 className="report-title">Password Settings</h2>
          </div>

          <form className="profile-form" onSubmit={handlePasswordSubmit}>
            <div className="form-grid">
              <label className="form-field form-field--full">
                Current Password
                <PasswordInput
                  value={passwordForm.currentPassword}
                  onChange={(event) => {
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                    setPasswordFeedback(null)
                  }}
                  placeholder="Enter your current password"
                  showPassword={passwordVisibility.passwordCurrent}
                  onToggle={() => togglePasswordVisibility('passwordCurrent')}
                />
              </label>

              <label className="form-field">
                New Password
                <PasswordInput
                  value={passwordForm.nextPassword}
                  onChange={(event) => {
                    setPasswordForm((current) => ({ ...current, nextPassword: event.target.value }))
                    setPasswordFeedback(null)
                  }}
                  placeholder="Enter a new password"
                  showPassword={passwordVisibility.passwordNext}
                  onToggle={() => togglePasswordVisibility('passwordNext')}
                />
              </label>

              <label className="form-field">
                Confirm Password
                <PasswordInput
                  value={passwordForm.confirmPassword}
                  onChange={(event) => {
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                    setPasswordFeedback(null)
                  }}
                  placeholder="Confirm the new password"
                  showPassword={passwordVisibility.passwordConfirm}
                  onToggle={() => togglePasswordVisibility('passwordConfirm')}
                />
              </label>
            </div>

            {passwordFeedback ? (
              <p
                className={
                  passwordFeedback.tone === 'success'
                    ? 'form-feedback form-feedback-success'
                    : 'form-feedback form-feedback-error'
                }
              >
                {passwordFeedback.message}
              </p>
            ) : null}

            <div className="profile-form-actions">
              <button type="submit" className="primary-button">
                Update Password
              </button>
            </div>
          </form>
        </article>
      </section>
    </section>
  )
}

function ProductImage({ name, imageUrl }) {
  if (imageUrl) {
    return (
      <div className="product-artwork">
        <img src={imageUrl} alt={name} />
      </div>
    )
  }

  return <div className="product-artwork product-artwork--placeholder">Image</div>
}

function ProductModal({
  mode,
  formValues,
  onChange,
  onImageSelect,
  onImageRemove,
  onClose,
  onSubmit,
  isImageLoading,
  isSaving,
}) {
  const isEditMode = mode === 'edit'

  return (
    <div className="modal-backdrop">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <div className="modal-header">
          <div>
            <p className="panel-kicker">Inventory</p>
            <h2 id="product-modal-title" className="modal-title">
              {isEditMode ? 'Update Item' : 'Add Item'}
            </h2>
            <p className="modal-description">
              {isEditMode
                ? 'Update the selected clothing item details.'
                : 'Create a new clothing item and save it to PostgreSQL.'}
            </p>
          </div>
        </div>

        <form className="modal-form" onSubmit={onSubmit}>
          <div className="form-grid">
            <label className="form-field">
              Item Name
              <input
                type="text"
                value={formValues.name}
                onChange={(event) => onChange('name', event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              Category
              <input
                type="text"
                value={formValues.category}
                onChange={(event) => onChange('category', event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              SKU
              <input
                type="text"
                value={formValues.sku}
                onChange={(event) => onChange('sku', event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              Quantity
              <input
                type="number"
                min="0"
                value={formValues.items}
                onChange={(event) => onChange('items', event.target.value)}
                required
              />
            </label>

            <div className="form-field form-field--full">
              <span>Item Image</span>
              <div className="image-upload-field">
                <label className="file-input-button" htmlFor="product-image-upload">
                  <input
                    id="product-image-upload"
                    className="file-input"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      onImageSelect(file)
                      event.target.value = ''
                    }}
                  />
                  {formValues.imageUrl ? 'Replace Image' : 'Upload Image'}
                </label>

                <div className="image-upload-copy">
                  <strong>{isImageLoading ? 'Reading image...' : formValues.imageName || 'No image selected'}</strong>
                  <span>Use JPG, PNG, or WEBP files from your device.</span>
                </div>

                {formValues.imageUrl ? (
                  <button
                    type="button"
                    className="secondary-button secondary-button-muted"
                    onClick={onImageRemove}
                  >
                    Remove Image
                  </button>
                ) : null}
              </div>

              {formValues.imageUrl ? (
                <div className="image-upload-preview">
                  <ProductImage name={formValues.name || 'Item image'} imageUrl={formValues.imageUrl} />
                </div>
              ) : null}
            </div>

            <label className="form-field form-field--full">
              Description
              <textarea
                rows="4"
                value={formValues.description}
                onChange={(event) => onChange('description', event.target.value)}
                required
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isImageLoading || isSaving}>
              {isImageLoading ? 'Uploading Image...' : isSaving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function DeleteModal({ product, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop">
      <section className="modal-card modal-card--compact" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
        <div className="modal-header">
          <div>
            <p className="panel-kicker">Inventory</p>
            <h2 id="delete-modal-title" className="modal-title">
              Delete Item
            </h2>
            <p className="modal-description">
              Remove <strong>{product.name}</strong> from the clothing inventory database?
            </p>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger-button" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </section>
    </div>
  )
}

function ProductDetailsModal({ product, onClose }) {
  const stockStatus = getStockStatus(product.items)

  return (
    <div className="modal-backdrop">
      <section
        className="modal-card modal-card--details shop-details-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-details-title"
      >
        <div className="shop-details-layout">
          <div className="shop-details-media">
            <ProductImage name={product.name} imageUrl={product.imageUrl} />
            {stockStatus === 'Low Stock' ? (
              <span className="stock-chip stock-chip--low-stock">Low Stock</span>
            ) : null}
          </div>

          <div className="shop-details-info">
            <div className="shop-details-heading">
              <p className="panel-kicker">Product Details</p>
              <h2 id="product-details-title" className="modal-title">
                {product.name}
              </h2>
              <span>{product.category}</span>
            </div>

            <div className="shop-details-stock">
              <strong>{formatItemCount(product.items)}</strong>
              <span>{stockStatus === 'Out of Stock' ? 'Out of stock' : 'Available stock'}</span>
            </div>

            <p className="shop-details-description">{product.description}</p>

            <div className="shop-details-specs">
              <div>
                <span>SKU</span>
                <strong>{product.sku}</strong>
              </div>
              <div>
                <span>Latest Update</span>
                <strong>{product.updates}</strong>
              </div>
            </div>

            <div className="modal-actions shop-details-actions">
              <button type="button" className="primary-button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
