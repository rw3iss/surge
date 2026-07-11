import { useSearchParams, } from '@solidjs/router';
import { createSignal, onCleanup, } from 'solid-js';

interface UseSearchFilterOptions {
    paramKey?: string;
    debounceMs?: number;
}

/** Query keys shared by the admin list pages (search/sort/status filters). */
export type SearchFilterParams = {
    search: string;
    sort: string;
    status: string;
    role: string;
    [key: string]: string;
};

/**
 * Debounced search input that syncs with URL query params.
 * Returns the current display value, a handler for input events,
 * and the searchParams/setSearchParams pair for additional filters.
 */
export function useSearchFilter<T extends Record<string, string> = SearchFilterParams>(
    options: UseSearchFilterOptions = {},
) {
    const paramKey = options.paramKey || 'search';
    const debounceMs = options.debounceMs ?? 300;

    const [searchParams, setSearchParams,] = useSearchParams<T>();
    const [searchInput, setSearchInput,] = createSignal((searchParams[paramKey] as string) || '',);

    let timer: ReturnType<typeof setTimeout> | undefined;

    const handleSearchInput = (value: string,) => {
        setSearchInput(value,);
        if (timer) clearTimeout(timer,);
        timer = setTimeout(() => {
            setSearchParams({ [paramKey]: value || undefined, } as Record<string, string | undefined>,);
        }, debounceMs,);
    };

    onCleanup(() => {
        if (timer) clearTimeout(timer,);
    },);

    return {
        searchInput,
        handleSearchInput,
        searchParams,
        setSearchParams,
    };
}
