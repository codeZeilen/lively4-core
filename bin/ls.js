import * as path from '/src/swx/path.jsx'

function format(child) {
    let string = ''

    if(child['type'] === 'directory') {
        string += 'd'
    } else {
        string += '-'
    }

    if(child['access']) {
        if(child['access']['read']) {
            string += 'r'
        } else {
            string += '-'
        }

        if(child['access']['write']) {
            string += 'w'
        } else {
            string += '-'
        }
    } else {
        string += '??'
    }

    string += ' '
    string += child['name']

    return string
}

export default async function ls(env, args) {
    let pathname = path.join(env.ENV.PWD, args[1] || '')

    let response = await fetch('https://lively4/' + pathname, {method: 'OPTIONS'})

    if(response.status < 200 || response.status > 399) {
        env.fd[2].emit('data', 'Error: ' + response.statusText)
        return 1
    }

    let fstat = await response.json()

    if(fstat['type'] !== 'directory') {
        env.fd[2].emit('data', 'Error: Not a directory')
        return 2
    }

    env.fd[1].emit('data', 'total ' + fstat['contents'].length + '\r\n')

    fstat['contents'].forEach((child) => {
        env.fd[1].emit('data', format(child) + '\r\n')
    })

    return 0
}
