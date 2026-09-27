type GraphFiltersProps = {
	categories: string[];
	locations: string[];
	years: string[];
	categoryFilter: string;
	locationFilter: string;
	yearFilter: string;
	setCategoryFilter: (value: string) => void;
	setLocationFilter: (value: string) => void;
	setYearFilter: (value: string) => void;
};

export function GraphFilters({
	categories,
	locations,
	years,
	categoryFilter,
	locationFilter,
	yearFilter,
	setCategoryFilter,
	setLocationFilter,
	setYearFilter,
}: GraphFiltersProps) {
	return (
		<div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 p-4 sm:p-6">
			<div className="pointer-events-auto grid gap-3 self-start rounded-3xl border border-white/15 bg-black/90 p-4 text-sm text-white backdrop-blur sm:grid-cols-3">
				<label className="flex min-w-40 flex-col gap-2 text-white">
					Category
					<select
						value={categoryFilter}
						onChange={(event) => setCategoryFilter(event.target.value)}
						className="rounded-2xl border border-white/15 bg-black pl-4 pr-10 py-3 text-white outline-none"
					>
						{categories.map((category) => (
							<option key={category} value={category}>
								{category}
							</option>
						))}
					</select>
				</label>

				<label className="flex min-w-40 flex-col gap-2 text-white">
					Location
					<select
						value={locationFilter}
						onChange={(event) => setLocationFilter(event.target.value)}
						className="rounded-2xl border border-white/15 bg-black pl-4 pr-10 py-3 text-white outline-none"
					>
						{locations.map((location) => (
							<option key={location} value={location}>
								{location}
							</option>
						))}
					</select>
				</label>

				<label className="flex min-w-32 flex-col gap-2 text-white">
					Year
					<select
						value={yearFilter}
						onChange={(event) => setYearFilter(event.target.value)}
						className="rounded-2xl border border-white/15 bg-black pl-4 pr-10 py-3 text-white outline-none"
					>
						{years.map((year) => (
							<option key={year} value={year}>
								{year}
							</option>
						))}
					</select>
				</label>
			</div>
		</div>
	);
}
