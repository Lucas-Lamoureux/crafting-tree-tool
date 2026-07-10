import { useState } from 'react';

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');

  function submit(event) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <form className="search-bar" onSubmit={submit}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find ID"
        aria-label="Find ID"
      />
    </form>
  );
}
