import type { DateFilter, SortMode, TypeFilter } from "../types";
import { CollapseIcon, ExpandIcon } from "./icons";

type FiltersCardProps = {
  filtersOpen: boolean;
  filtersActive: boolean;
  typeFilter: TypeFilter;
  sizeMinMb: string;
  sizeMaxMb: string;
  dateFilter: DateFilter;
  sortMode: SortMode;
  contentSearch: boolean;
  contentLoading: boolean;
  contentMatches: Set<string>;
  query: string;
  onToggleOpen: () => void;
  onTypeFilterChange: (value: TypeFilter) => void;
  onSizeMinChange: (value: string) => void;
  onSizeMaxChange: (value: string) => void;
  onDateFilterChange: (value: DateFilter) => void;
  onSortModeChange: (value: SortMode) => void;
  onContentSearchChange: (value: boolean) => void;
  onClearFilters: () => void;
};

export function FiltersCard({
  filtersOpen,
  filtersActive,
  typeFilter,
  sizeMinMb,
  sizeMaxMb,
  dateFilter,
  sortMode,
  contentSearch,
  contentLoading,
  contentMatches,
  query,
  onToggleOpen,
  onTypeFilterChange,
  onSizeMinChange,
  onSizeMaxChange,
  onDateFilterChange,
  onSortModeChange,
  onContentSearchChange,
  onClearFilters,
}: FiltersCardProps) {
  return (
    <div className="card filters">
      <div className="filters-header">
        <div>
          <p className="label">Filters</p>
          <p className="meta">
            {filtersActive ? "Filters active." : "Refine results in this folder."}
          </p>
        </div>
        <button
          className="ghost filters-toggle"
          type="button"
          onClick={onToggleOpen}
          aria-expanded={filtersOpen}
          aria-controls="filters-panel"
          aria-label={filtersOpen ? "Collapse filters" : "Expand filters"}
          title={filtersOpen ? "Collapse filters" : "Expand filters"}
        >
          {filtersOpen ? <CollapseIcon /> : <ExpandIcon />}
        </button>
      </div>
      <div
        id="filters-panel"
        className={`filters-panel ${filtersOpen ? "open" : "collapsed"}`}
        aria-hidden={!filtersOpen}
      >
        <div className="filter-controls">
          <div className="filter-group">
            <label className="filter-label" htmlFor="type-filter">
              Type
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(event) => onTypeFilterChange(event.target.value as TypeFilter)}
            >
              <option value="all">All entries</option>
              <option value="dir">Folders</option>
              <option value="file">Files</option>
              <option value="image">Images</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
              <option value="document">Documents</option>
              <option value="archive">Archives</option>
              <option value="other">Other files</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label" htmlFor="size-min">
              Size (MB)
            </label>
            <div className="filter-range">
              <input
                id="size-min"
                type="number"
                min="0"
                step="0.1"
                placeholder="Min"
                value={sizeMinMb}
                onChange={(event) => onSizeMinChange(event.target.value)}
              />
              <input
                id="size-max"
                type="number"
                min="0"
                step="0.1"
                placeholder="Max"
                value={sizeMaxMb}
                onChange={(event) => onSizeMaxChange(event.target.value)}
              />
            </div>
          </div>
          <div className="filter-group">
            <label className="filter-label" htmlFor="date-filter">
              Modified
            </label>
            <select
              id="date-filter"
              value={dateFilter}
              onChange={(event) => onDateFilterChange(event.target.value as DateFilter)}
            >
              <option value="any">Any time</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label" htmlFor="sort-mode">
              Sort
            </label>
            <select
              id="sort-mode"
              value={sortMode}
              onChange={(event) => onSortModeChange(event.target.value as SortMode)}
            >
              <option value="default">Default order</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="date-desc">Date (newest)</option>
              <option value="date-asc">Date (oldest)</option>
              <option value="size-desc">Size (largest)</option>
              <option value="size-asc">Size (smallest)</option>
              <option value="type-asc">Type (A-Z)</option>
              <option value="type-desc">Type (Z-A)</option>
            </select>
          </div>
          <div className="filter-group filter-actions">
            <button className="ghost" onClick={onClearFilters} disabled={!filtersActive}>
              Reset Filters
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}
