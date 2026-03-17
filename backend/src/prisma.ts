import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton
 * - export ทั้งแบบ named และ default เพื่อให้ import ได้ทั้งสองแบบ
 *   (กัน error จากไฟล์ที่เขียน import ต่างรูปแบบกัน)
 */
const prisma = new PrismaClient();

export { prisma };
export default prisma;
