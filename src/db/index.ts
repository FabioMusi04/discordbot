class Database {
  private static instance: Deno.Kv;

  private constructor() {}

  public static async getInstance(): Promise<Deno.Kv> {
    if (!Database.instance) {
      Database.instance = await Deno.openKv();
    }
    return Database.instance;
  }

  public static async connect() {
    const kv = await Database.getInstance();
    return kv;
  }

  public static async disconnect() {
    const kv = await Database.getInstance();
    kv.close();
  }
}

export default Database;
