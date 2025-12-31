import {createClient} from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

let supabaseInstance: ReturnType<typeof createClient> | null = null;

const getSupabaseClient = () => {
    if (!supabaseInstance) {
        supabaseInstance = createClient(supabaseUrl, supabaseKey);
    }
    return supabaseInstance;
};

const supabase = getSupabaseClient();

export interface SupabaseQueryOptions {
    table: string;
    select?: string;
    filters?: Record<string, any>;
    orderBy?: {
        column: string;
        ascending?: boolean;
    };
    limit?: number;
    offset?: number;
}

export interface SupabaseQueryResult<T = any> {
    data: T[] | null;
    error: any;
    count?: number | null;
}

export class SupabaseService {
    static async query<T = any>(options: SupabaseQueryOptions): Promise<SupabaseQueryResult<T>> {
        try {
            let query = supabase
                .from(options.table)
                .select(options.select || '*');

            if (options.filters) {
                Object.entries(options.filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        query = query.eq(key, value);
                    }
                });
            }

            if (options.orderBy) {
                query = query.order(options.orderBy.column, {
                    ascending: options.orderBy.ascending ?? true,
                });
            }

            if (options.limit) {
                query = query.limit(options.limit);
            }

            if (options.offset) {
                query = query.range(options.offset, (options.offset + (options.limit || 10)) - 1);
            }

            const {data, error, count} = await query;

            return {
                data: data as T[],
                error,
                count,
            };
        } catch (error) {
            console.error('Supabase query error:', error);
            return {
                data: null,
                error,
            };
        }
    }

    static async getByEmail<T = any>(table: string, email: string, select?: string): Promise<SupabaseQueryResult<T>> {
        return this.query<T>({
            table,
            select,
            filters: {email},
            limit: 1,
        });
    }

    static async getEmployeeByEmail(email: string) {
        return this.getByEmail(
            'employees',
            email,
            'email, department, first_name, last_name, job_title, "mysquad_ext_ds_access"',
        );
    }
}

export {supabase, getSupabaseClient};
