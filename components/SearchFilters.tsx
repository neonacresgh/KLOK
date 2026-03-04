'use client';

import { useState, useEffect } from 'react';

interface SearchFiltersProps {
  onSearch: (query: string, filters: {
    gender?: string;
    emailStatus?: string;
    roleRank?: string;
  }) => void;
  onClear: () => void;
}

export default function SearchFilters({ onSearch, onClear }: SearchFiltersProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    gender: '',
    emailStatus: '',
    roleRank: '',
  });

  // Debounced search - triggers automatically as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query, {
        gender: filters.gender || undefined,
        emailStatus: filters.emailStatus || undefined,
        roleRank: filters.roleRank || undefined,
      });
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [query, filters, onSearch]);

  const handleSearch = () => {
    onSearch(query, {
      gender: filters.gender || undefined,
      emailStatus: filters.emailStatus || undefined,
      roleRank: filters.roleRank || undefined,
    });
  };

  const handleClear = () => {
    setQuery('');
    setFilters({
      gender: '',
      emailStatus: '',
      roleRank: '',
    });
    onClear();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Search & Filter</h3>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search Students
          </label>
          <input
            type="text"
            id="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search by name, email, or role..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="genderFilter" className="block text-sm font-medium text-gray-700 mb-2">
              Gender
            </label>
            <select
              id="genderFilter"
              value={filters.gender}
              onChange={(e) => setFilters(prev => ({ ...prev, gender: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-2">
              Email Status
            </label>
            <select
              id="statusFilter"
              value={filters.emailStatus}
              onChange={(e) => setFilters(prev => ({ ...prev, emailStatus: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          <div>
            <label htmlFor="roleFilter" className="block text-sm font-medium text-gray-700 mb-2">
              Role / Rank
            </label>
            <input
              type="text"
              id="roleFilter"
              value={filters.roleRank}
              onChange={(e) => setFilters(prev => ({ ...prev, roleRank: e.target.value }))}
              placeholder="Filter by role..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handleSearch}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Search
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
