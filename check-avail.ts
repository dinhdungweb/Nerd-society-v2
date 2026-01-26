
import { prisma } from './src/lib/prisma'

async function checkData() {
    const user = await prisma.user.findFirst({
        where: { email: 'dungdd.work@gmail.com' }
    })

    if (!user) {
        console.log('User not found')
        return
    }

    console.log('User ID:', user.id)

    const availabilities = await prisma.userStudyAvailability.findMany({
        where: { userId: user.id },
        include: { slot: true }
    })

    console.log('Availabilities count:', availabilities.length)
    console.log(JSON.stringify(availabilities, null, 2))
}

checkData()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
