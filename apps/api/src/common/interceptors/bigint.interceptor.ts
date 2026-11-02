import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function sanitizeBigInt(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'bigint') {
    const num = Number(val);
    return Number.isSafeInteger(num) ? num : val.toString();
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeBigInt);
  }
  if (typeof val === 'object' && !(val instanceof Date) && !(val instanceof Buffer)) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = sanitizeBigInt(v);
    }
    return res;
  }
  return val;
}

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => sanitizeBigInt(data)));
  }
}
