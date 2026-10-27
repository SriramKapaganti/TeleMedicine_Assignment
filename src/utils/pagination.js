'use strict';

/**
 * Encodes cursor from a value (e.g. ID, date).
 */
function encodeCursor(value) {
  if (!value) return null;
  return Buffer.from(String(value)).toString('base64');
}

/**
 * Decodes base64 cursor.
 */
function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    return Buffer.from(cursor, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Formats paginated response payload.
 */
function formatPaginatedResponse(items, limit, getCursorValue = (item) => item.id) {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore && data.length > 0 ? encodeCursor(getCursorValue(data[data.length - 1])) : null;

  return {
    data,
    meta: {
      count: data.length,
      limit,
      hasMore,
      nextCursor,
    },
  };
}

module.exports = {
  encodeCursor,
  decodeCursor,
  formatPaginatedResponse,
};
