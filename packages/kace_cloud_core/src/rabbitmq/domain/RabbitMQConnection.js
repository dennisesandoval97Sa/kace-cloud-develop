import { CustomError } from '../../shared/index.js';

export class RabbitMQConnection {
    constructor({ id, name, host, port = 5672, queue, vhost = null, exchange = null, username = null, password = null }) {
        this.id = id;
        this.name = name;
        this.host = host;
        this.port = port;
        this.queue = queue;
        this.vhost = vhost;
        this.exchange = exchange;
        this.username = username;
        this.password = password;
    }

    static create(dto) {
        if (!dto) throw new CustomError('RabbitMQConnection invalid: dto is required');
        const { host, queue } = dto;
        if (!host) throw new CustomError('RabbitMQConnection invalid: host is required');
        if (!queue) throw new CustomError('RabbitMQConnection invalid: queue is required');
        return new RabbitMQConnection(dto);
    }
}
