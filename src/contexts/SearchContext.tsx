import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
import { NewsItem } from '@/types/news';
import { searchNews } from '@/utils/news-utils';

interface SearchContextType {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    showSearchModal: boolean;
    openSearch: () => void;
    closeSearch: () => void;
    clearSearch: () => void;
    allNews: NewsItem[];
    setAllNews: (news: NewsItem[]) => void;
    searchResults: NewsItem[];
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider = ({ children }: { children: ReactNode }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [allNews, setAllNews] = useState<NewsItem[]>([]);

    const openSearch = useCallback(() => setShowSearchModal(true), []);
    const closeSearch = useCallback(() => setShowSearchModal(false), []);
    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setShowSearchModal(false);
    }, []);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim() || allNews.length === 0) return [];
        return searchNews(allNews, searchQuery).slice(0, 15); // Top 15 resultados en vivo
    }, [allNews, searchQuery]);

    return (
        <SearchContext.Provider value={{
            searchQuery,
            setSearchQuery,
            showSearchModal,
            openSearch,
            closeSearch,
            clearSearch,
            allNews,
            setAllNews,
            searchResults
        }}>
            {children}
        </SearchContext.Provider>
    );
};

export const useSearch = () => {
    const context = useContext(SearchContext);
    if (context === undefined) {
        throw new Error('useSearch must be used within a SearchProvider');
    }
    return context;
};
