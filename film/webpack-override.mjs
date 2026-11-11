// Lets TypeScript sources import with NodeNext ".js" specifiers.
export const webpackOverride = (config) => ({
  ...config,
  resolve: { ...config.resolve, extensionAlias: { '.js': ['.ts', '.tsx', '.js'] } },
});
