'use client';

import { useState, useCallback } from 'react';

interface Filters {
  search: string;
  category: string;
  priceMin: number;
  priceMax: number;
  inStock: string;
  sortBy: string;
}

interface AdvancedSearchProps {
  onSearch: (filters: Filters) => void;
  loading?: boolean;
}

export function AdvancedSearch({ onSearch, loading }: AdvancedSearchProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: '',
    priceMin: 0,
    priceMax: 10000,
    inStock: '',
    sortBy: 'name',
  });

  const handleChange = useCallback(
    (field: keyof Filters, value: string | number) => {
      const newFilters = { ...filters, [field]: value };
      setFilters(newFilters);
    },
    [filters]
  );

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleReset = () => {
    const defaultFilters: Filters = {
      search: '',
      category: '',
      priceMin: 0,
      priceMax: 10000,
      inStock: '',
      sortBy: 'name',
    };
    setFilters(defaultFilters);
    onSearch(defaultFilters);
  };

  const activeFiltersCount = [
    filters.search,
    filters.category,
    filters.priceMin > 0 || filters.priceMax < 10000,
    filters.inStock,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by name, SKU, or description..."
          value={filters.search}
          onChange={(e) => handleChange('search', e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
        >
          🔍 Search
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition flex items-center gap-2"
        >
          ⚙️ Filters {activeFiltersCount > 0 && <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFiltersCount}</span>}
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200 space-y-4">
          <h3 className="font-bold text-gray-900">Advanced Filters</h3>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={filters.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="accessories">Accessories</option>
              <option value="software">Software</option>
              <option value="services">Services</option>
            </select>
          </div>

          {/* Price Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Price</label>
              <input
                type="number"
                value={filters.priceMin}
                onChange={(e) => handleChange('priceMin', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Price</label>
              <input
                type="number"
                value={filters.priceMax}
                onChange={(e) => handleChange('priceMax', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Stock Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
            <select
              value={filters.inStock}
              onChange={(e) => handleChange('inStock', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Products</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleChange('sortBy', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Name (A-Z)</option>
              <option value="price-low">Price (Low to High)</option>
              <option value="price-high">Price (High to Low)</option>
              <option value="newest">Newest</option>
              <option value="popular">Most Popular</option>
            </select>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
            >
              Apply Filters
            </button>
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition"
            >
              Reset All
            </button>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2">
              Search: {filters.search}
              <button
                onClick={() => handleChange('search', '')}
                className="hover:text-blue-900 font-bold"
              >
                ✕
              </button>
            </span>
          )}
          {filters.category && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2">
              Category: {filters.category}
              <button
                onClick={() => handleChange('category', '')}
                className="hover:text-blue-900 font-bold"
              >
                ✕
              </button>
            </span>
          )}
          {(filters.priceMin > 0 || filters.priceMax < 10000) && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2">
              Price: ${filters.priceMin}-${filters.priceMax}
              <button
                onClick={() => {
                  handleChange('priceMin', 0);
                  handleChange('priceMax', 10000);
                }}
                className="hover:text-blue-900 font-bold"
              >
                ✕
              </button>
            </span>
          )}
          {filters.inStock && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2">
              Stock: {filters.inStock}
              <button
                onClick={() => handleChange('inStock', '')}
                className="hover:text-blue-900 font-bold"
              >
                ✕
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
