import { AuthenticationAccountRepository,
	AuthenticationUser,
    AuthenticationUserImpl } from 'authentication-flows-js';
import { EsBaseRepository } from "./elasticsearch-base-repository";
const debug = require('debug')('authentication-account-elasticsearch-repository');

const AUTH_ACCOUNT_INDEX: string = 'authentication-account';

export class AuthenticationAccountElasticsearchRepository extends EsBaseRepository<AuthenticationUser> implements AuthenticationAccountRepository {

    protected getIndex(): string {
        return AUTH_ACCOUNT_INDEX;
    }

    async loadUserByUsername(username: string): Promise<AuthenticationUser> {
        return await this.getItem(username);
    }

    async setEnabled(username: string) {
        await this.setEnabledFlag(username, true);
    }

    async setDisabled(username: string) {
        await this.setEnabledFlag(username, false);
    }

    protected async setEnabledFlag(username: string, enabled: boolean) {

        await this.updateItem(username, { enabled: enabled });
    }

    async isEnabled(username: string): Promise<boolean> {
        const storedUser: AuthenticationUser =  await this.loadUserByUsername(username);
        if (!storedUser)
            return false;
        return await storedUser.isEnabled();
    }

    //TODO: should be in abstract class
    async decrementAttemptsLeft(username: string) {
        const storedUser: AuthenticationUser =  await this.loadUserByUsername(username);
        let attempts = storedUser.getLoginAttemptsLeft();
        debug(`current num attempts: ${attempts}`);
        await this.setAttemptsLeft(username, --attempts);
    }

    async setAttemptsLeft(username: string, numAttemptsAllowed: number) {
        await this.updateItem(username, { numAttemptsAllowed: numAttemptsAllowed });
    }

    async setPassword(username: string, newPassword: string) {
        await this.updateItem(username, {
            password: newPassword,
            link: null,
            linkDate: null
        });
    }

    //TODO: should be in abstract class, async/await
    async getEncodedPassword(username: string): Promise<string> {
        const storedUser: AuthenticationUser =  await this.loadUserByUsername(username);
        if (!storedUser)
            return null;
        return storedUser.getPassword();
    }

    async getPasswordLastChangeDate(username: string): Promise<Date> {
        const storedUser: AuthenticationUser =  await this.loadUserByUsername(username);
        return storedUser.getPasswordLastChangeDate();
    }

    setAuthority(username: string, authority: string) {
        throw new Error("Method not implemented.");
    }

    async createUser(authenticationUser: AuthenticationUser): Promise<void> {
        debug('createUser / inmem implementation!');

        const newUser: AuthenticationUser = new AuthenticationUserImpl(authenticationUser.getUsername(),
            authenticationUser.getPassword(),
            false,
            authenticationUser.getLoginAttemptsLeft(),
            new Date(),
            authenticationUser.getFirstName(),
            authenticationUser.getLastName(),
            authenticationUser.getAuthorities(),
            authenticationUser.getLink(),
            authenticationUser.getLinkDate());

        if( this.userExists( newUser.getUsername() ) ) {
            //ALREADY_EXIST:
            throw new Error(`user ${newUser.getUsername()} already exists`);
        }

        this.indexItem(newUser.getUsername(), newUser);
    }

    async deleteUser(username: string): Promise<void> {
        await this.deleteItem(username);
    }

    async userExists(username: string): Promise<boolean> {
        debug('userExists?');
        return await this.exists(username);
    }

    async addLink(username: string, link: string) {
        await this.updateItem(username, {
            link: link,
            linkDate: new Date()
        });
    }

    /**
     * remove link
     * @param link
     */
    async removeLink(username: string): Promise<boolean> {
        await this.updateItem(username, { link: null });
        return true;
    }

    //this is for the automation only:
    async getLink(username: string): Promise<{ link: string; date: Date; }> {
        const storedUser: AuthenticationUser =  await this.loadUserByUsername(username);
        return {
            link: storedUser.getLink(),
            date: storedUser.getLinkDate()
        };
    }

    async getUsernameByLink(link: string): Promise<string> {
        const item = await this.getItem(link);
        if(!item)
            throw new Error("Could not find any user with this link.");

        return item.getUsername();
    }
}
